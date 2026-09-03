"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanSearch,
  UploadCloud,
} from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { canvasToDataUrl, loadFileAsCanvas } from "@/lib/barcodeDetector";
import { ImageQualityCheck } from "./ImageQualityCheck";
import type { QualityVerdict } from "@/lib/types";

interface LabelCaptureProps {
  busy: boolean;
  phase?: string;
  onSubmit: (canvas: HTMLCanvasElement, previewUrl: string) => void;
}

export function LabelCapture({ busy, phase, onSubmit }: LabelCaptureProps) {
  const { videoRef, status, error, start, stop, captureFrame } = useCamera();
  const [captureMode, setCaptureMode] = useState(false);
  const [photo, setPhoto] = useState<{ canvas: HTMLCanvasElement; url: string } | null>(null);
  const [verdict, setVerdict] = useState<QualityVerdict | null>(null);
  const [overrideQuality, setOverrideQuality] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const acceptCanvas = useCallback((canvas: HTMLCanvasElement) => {
    setPhoto({ canvas, url: canvasToDataUrl(canvas, 0.85) });
    setOverrideQuality(false);
  }, []);

  useEffect(() => {
    if (captureMode && status === "idle") void start("environment");
  }, [captureMode, start, status]);

  useEffect(() => {
    if (!captureMode && status === "live") stop();
  }, [captureMode, status, stop]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      try {
        const canvas = await loadFileAsCanvas(file);
        acceptCanvas(canvas);
      } catch {
        /* unsupported file — ignore */
      }
    },
    [acceptCanvas]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) void handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const takePhoto = useCallback(() => {
    const canvas = captureFrame();
    if (canvas) {
      acceptCanvas(canvas);
      stop();
      setCaptureMode(false);
    }
  }, [acceptCanvas, captureFrame, stop]);

  const canSubmit =
    Boolean(photo) &&
    !busy &&
    (verdict === null || verdict.verdict !== "fail" || overrideQuality);

  return (
    <div>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
          dragging
            ? "border-accent bg-orange-50"
            : "border-line bg-paper hover:border-accent/50 hover:bg-paper/70"
        }`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-accent" />
            <p className="text-xs font-bold text-ink">{phase ?? "Running server-side OCR…"}</p>
            <p className="text-[11px] text-ink-soft">
              First call downloads the OCR model — subsequent scans are fast.
            </p>
          </div>
        ) : photo ? (
          <img src={photo.url} alt="Label to inspect" className="absolute inset-0 h-full w-full object-contain" />
        ) : captureMode ? (
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <UploadCloud className="h-9 w-9 text-accent" />
            <p className="text-sm font-bold text-ink">Drop the label photo here</p>
            <p className="text-xs text-ink-soft">…or paste from the clipboard</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {!photo && !captureMode && (
          <>
            <button
              onClick={() => setCaptureMode(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Take a photo
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-paper/70 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" /> Upload image
            </button>
          </>
        )}
        {captureMode && (
          <>
            <button
              onClick={takePhoto}
              disabled={status !== "live" || busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {status === "starting" ? "Starting…" : "Capture photo"}
            </button>
            <button
              onClick={() => {
                stop();
                setCaptureMode(false);
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-paper/70 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
        {photo && (
          <>
            <button
              onClick={() => {
                setPhoto(null);
                setVerdict(null);
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-paper/70 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> Retake / choose another
            </button>
            <button
              onClick={() => {
                if (photo) onSubmit(photo.canvas, photo.url);
              }}
              disabled={!canSubmit}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ScanSearch className="h-4 w-4" />
              {verdict?.verdict === "fail" && overrideQuality
                ? "Inspect anyway"
                : "Inspect label (OCR + rules)"}
            </button>
          </>
        )}
      </div>

      {error && !photo && (
        <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-800">
          {error}
        </p>
      )}

      <ImageQualityCheck canvas={photo?.canvas ?? null} onVerdict={setVerdict} />

      {verdict?.verdict === "fail" && !overrideQuality && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-red-700">
            OCR will likely fail on this photo.
          </p>
          <button
            onClick={() => setOverrideQuality(true)}
            className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
          >
            Try anyway
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
