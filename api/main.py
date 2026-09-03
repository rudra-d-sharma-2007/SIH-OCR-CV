"""
LabelScan OCR/CV service — Python edition.

Stack: FastAPI + OpenCV + PaddleOCR (+ NumPy).

Endpoints
---------
GET  /health   engine availability + versions
POST /ocr      multipart `image` -> { ok, text, words, engine, duration_ms }

The Next.js route `src/app/api/scan/route.ts` calls this service first when the
`PYTHON_OCR_URL` env var is set, and falls back to its bundled Node OCR
otherwise — so the web app keeps working even before PaddleOCR is installed.

Optional heavy deps (paddleocr + paddlepaddle) are *not* in requirements.txt
so the base deploy stays light. Enable OCR with:

    pip install -r requirements.txt -r requirements-ocr.txt

Run locally:
    uvicorn main:app --host 0.0.0.0 --port 8787
"""

from __future__ import annotations

import time

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="LabelScan OCR/CV (Python)", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# PaddleOCR is imported lazily so the service boots without it.
# ---------------------------------------------------------------------------

PADDLE_AVAILABLE = False
PADDLE_IMPORT_ERROR: str | None = None
_ocr_engine = None

try:  # pragma: no cover - exercised only when paddle is installed
    from paddleocr import PaddleOCR  # type: ignore

    PADDLE_AVAILABLE = True
except Exception as err:  # noqa: BLE001 - surface any import failure to /health
    PADDLE_AVAILABLE = False
    PADDLE_IMPORT_ERROR = f"{type(err).__name__}: {err}"

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
MIN_LINE_CONFIDENCE = 0.45


def _get_engine():
    """Lazy singleton OCR engine (English, with angle classifier)."""
    global _ocr_engine
    if not PADDLE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "PaddleOCR is not installed on this server. Run: "
                "pip install -r requirements.txt -r requirements-ocr.txt "
                f"({PADDLE_IMPORT_ERROR})"
            ),
        )
    if _ocr_engine is None:
        _ocr_engine = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            show_log=False,
            use_gpu=False,
        )
    return _ocr_engine


def _decode_image(raw: bytes) -> np.ndarray:
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode the image.")
    return img


def _preprocess(img: np.ndarray) -> np.ndarray:
    """OpenCV pass: bound the size, equalize lighting, sharpen edges a touch."""
    height, width = img.shape[:2]
    longest = max(height, width)
    if longest > 2000:
        scale = 2000 / longest
        img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)

    # CLAHE on the luminance plane flattens uneven store lighting.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_plane, a_plane, b_plane = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    l_plane = clahe.apply(l_plane)
    img = cv2.cvtColor(cv2.merge((l_plane, a_plane, b_plane)), cv2.COLOR_LAB2BGR)

    # Mild unsharp mask helps thin printed digits read more cleanly.
    blurred = cv2.GaussianBlur(img, (0, 0), 1.1)
    img = cv2.addWeighted(img, 1.35, blurred, -0.35, 0)
    return img


def _ocr_once(img: np.ndarray) -> list[tuple[str, float]]:
    """Runs PaddleOCR once; returns [(text, confidence), …] sorted top→bottom."""
    engine = _get_engine()
    result = engine.ocr(img, cls=True)  # legacy 2.x API shape
    lines: list[tuple[str, float]] = []

    # PaddleOCR >= 2.7 returns result = [ [ [box, (text, score)], ... ] , ... ]
    # (multi-page images come back as a list of pages).
    pages = result if isinstance(result, (list, tuple)) else []
    for page in pages:
        if not page:
            continue
        for entry in page:
            try:
                box, (text, score) = entry
            except (TypeError, ValueError):
                continue
            t = str(text).strip()
            if t and float(score) >= MIN_LINE_CONFIDENCE:
                # sort key: average y of the box corners
                ys = [pt[1] for pt in box]
                lines.append((t, float(score), float(sum(ys)) / len(ys)))

    lines.sort(key=lambda item: item[2])
    return [(t, s) for t, s, _y in lines]


def _join_text(lines: list[tuple[str, float]]) -> str:
    return "\n".join(t for t, _s in lines)


@app.get("/health")
def health():
    versions = {
        "fastapi": app.version,
        "opencv": cv2.__version__,
        "numpy": np.__version__,
        "paddleocr": PADDLE_AVAILABLE,
    }
    return {
        "ok": True,
        "engine": "paddleocr" if PADDLE_AVAILABLE else None,
        "paddle_import_error": PADDLE_IMPORT_ERROR,
        "versions": versions,
        "hint": "pip install -r requirements.txt -r requirements-ocr.txt" if not PADDLE_AVAILABLE else None,
    }


@app.post("/ocr")
async def ocr(image: UploadFile = File(...)):
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    raw = await image.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB).")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image.")

    started = time.monotonic()
    img = _decode_image(raw)
    img = _preprocess(img)

    lines = _ocr_once(img)
    text = _join_text(lines)

    # Upright-only photographs (labels rotated 180°) come back nearly empty —
    # retry once on the rotated frame and keep whichever read more characters.
    if len(text.strip()) < 12:
        rotated = _ocr_once(cv2.rotate(img, cv2.ROTATE_180))
        if len(_join_text(rotated)) > len(text):
            lines, text = rotated, _join_text(rotated)

    return {
        "ok": True,
        "engine": "paddleocr",
        "text": text.strip(),
        "words": [
            {"text": t, "confidence": round(s, 3)}
            for t, s in lines
        ],
        "duration_ms": int((time.monotonic() - started) * 1000),
    }
