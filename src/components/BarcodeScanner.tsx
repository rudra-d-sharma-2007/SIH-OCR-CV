"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw, SwitchCamera } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { canvasToDataUrl, decodeCanvas } from "@/lib/barcodeDetector";
import type { DecodeHit } from "@/lib/types";

interface BarcodeScannerProps {
  busy: boolean;
  onDetected: (hit: DecodeHit) => void;
}

export function BarcodeScanner({ busy, onDetected }: BarcodeScannerProps) {
  const { videoRef, status, error, start, stop, switchCamera } = useCamera();
  const [found, setFound] = useState<{ hit: DecodeHit; url: string } | null>(null);
  const loopRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const stopLoop = useCallback(() => {
    if (loopRef.current !== null) {
      window.clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    loopRef.current = window.setInterval(() => {
      if (busyRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      let canvas = canvasRef.current;
      if (!canvas) canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / Math.max(vw, vh));
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      canvasRef.current = canvas;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const hit = decodeCanvas(canvas, { fast: true });
      if (hit) {
        stopLoop();
        const url = canvasToDataUrl(canvas, 0.85);
        setFound({ hit, url });
        onDetected(hit);
      }
    }, 250);
  }, [onDetected, stopLoop, videoRef]);

  const begin = useCallback(
    async (facing: "environment" | "user") => {
      setFound(null);
      await start(facing);
      // the status effect below starts the decode loop once the stream is live
    },
    [start]
  );

  useEffect(() => {
    if (status === "live" && !found) startLoop();
    return () => stopLoop();
  }, [status, found, startLoop, stopLoop]);

  const handleRescan = () => {
    setFound(null);
    if (status === "live") startLoop();
    else void begin("environment");
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-line bg-ink">
        <div className="relative aspect-[4/3] w-full bg-[repeating-linear-gradient(45deg,#1d1915_0,#1d1915_12px,#221d18_12px,#221d18_24px)]">
          {found ? (
            <img
              src={found.url}
              alt="Detected barcode frame"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-contain" />
          )}

          {busy && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-ink/85 text-white">
              <RefreshCw className="h-6 w-6 animate-spin text-orange-400" />
              <span className="px-4 text-center text-xs font-semibold">
                Looking the code up in the product database…
              </span>
            </div>
          )}

          {status === "live" && !found && (
            <div className="pointer-events-none absolute inset-0 z-10">
              <div className="absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-orange-500/70 shadow-[0_0_12px_rgba(234,88,12,0.9)]" />
              <div className="absolute inset-4 rounded-lg border-2 border-white/30" />
            </div>
          )}
          {status === "live" && (
            <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-md bg-ink/80 px-2 py-1 font-mono-scan text-[10px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              LIVE · auto-detect
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "idle" || status === "error" ? (
          <>
            <button
              onClick={() => void begin("environment")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white hover:bg-accent-deep"
            >
              <Camera className="h-4 w-4" /> Start camera
            </button>
            <button
              onClick={() => void begin("user")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-paper/70"
            >
              Use front camera
            </button>
          </>
        ) : status === "starting" ? (
          <span className="inline-flex items-center gap-2 px-2 py-2 text-xs font-semibold text-ink-soft">
            <RefreshCw className="h-4 w-4 animate-spin" /> Requesting camera…
          </span>
        ) : (
          <>
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-paper/70"
            >
              <CameraOff className="h-4 w-4" /> Stop
            </button>
            <button
              onClick={() => void switchCamera()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-xs font-bold text-ink hover:bg-paper/70"
            >
              <SwitchCamera className="h-4 w-4" /> Switch
            </button>
            {found && (
              <button
                onClick={handleRescan}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Rescan
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-800">
          {error}
        </p>
      )}
      {status === "idle" && !error && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
          Point at the EAN/UPC barcode or QR code — the feed auto-detects and
          freezes on the first clean read. QR payloads are parsed for GS1 date
          & batch fields automatically.
        </p>
      )}
    </div>
  );
}
