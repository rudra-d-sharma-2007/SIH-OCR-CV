# LabelScan Python OCR/CV service

FastAPI + OpenCV + PaddleOCR. This is the OCR/CV layer for the label-inspection
app: the Next.js route `src/app/api/scan/route.ts` calls it first when
`PYTHON_OCR_URL` is set, and falls back to bundled Node Tesseract otherwise.

## Run it locally

```bash
cd api
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt                        # fastapi, opencv, numpy
uvicorn main:app --host 0.0.0.0 --port 8787
```

Check it: `curl localhost:8787/health` → `"engine": null` (OCR disabled until
PaddleOCR is installed — the API still boots).

## Enable PaddleOCR

```bash
pip install -r requirements-ocr.txt    # paddlepaddle==2.6.1 + paddleocr==2.7.0.3
```

First OCR call downloads the English detection/recognition models
(`~/.paddleocr`) — allow a minute or two, later calls are fast.

```bash
curl localhost:8787/health   # → "engine": "paddleocr"
curl -F "image=@label.jpg" localhost:8787/ocr
```

## Wire it into the web app

Set one environment variable (Freebuff: Settings → Environment / Keys):

- `PYTHON_OCR_URL` = `http://localhost:8787` in local dev, or the deployed
  URL in production.

Then label scans on `/scan` run: OpenCV preprocessing → PaddleOCR → field
extraction → Legal Metrology/FSSAI rules engine.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | engine + version availability |
| POST | `/ocr` | multipart `image` → `{ text, words, engine, duration_ms }` |

## Notes

- PaddleOCR 2.7.0.3 + paddlepaddle 2.6.1 is the pinned, tested API pair for
  `main.py` (the `use_angle_cls`/`ocr(img, cls=True)` interface). Newer 3.x
  changed the API — pin if you upgrade.
- `requirements.txt` deliberately stays light (no paddle) so the managed
  deploy installs quickly; add `-r requirements-ocr.txt` when you want the
  full engine on the server.
