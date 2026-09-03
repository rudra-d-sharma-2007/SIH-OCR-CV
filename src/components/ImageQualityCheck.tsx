"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Focus } from "lucide-react";
import { analyzeImageQuality } from "@/lib/imageValidation";
import type { QualityVerdict } from "@/lib/types";

interface ImageQualityCheckProps {
  canvas: HTMLCanvasElement | null;
  onVerdict: (verdict: QualityVerdict | null) => void;
}

export function ImageQualityCheck({ canvas, onVerdict }: ImageQualityCheckProps) {
  const [verdict, setVerdict] = useState<QualityVerdict | null>(null);
  const lastCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvas || canvas === lastCanvas.current) return;
    lastCanvas.current = canvas;
    let cancelled = false;
    // defer to the next frame so the preview paints first
    const raf = requestAnimationFrame(() => {
      try {
        const v = analyzeImageQuality(canvas);
        if (!cancelled) {
          setVerdict(v);
          onVerdict(v);
        }
      } catch {
        if (!cancelled) {
          setVerdict(null);
          onVerdict(null);
        }
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [canvas, onVerdict]);

  if (!canvas || !verdict) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-line bg-paper/60 px-3 py-2.5 text-xs text-ink-soft">
        Photo quality is checked before OCR: focus, brightness and contrast.
      </div>
    );
  }

  const tone =
    verdict.verdict === "pass"
      ? { icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-800" }
      : verdict.verdict === "warn"
        ? { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-800" }
        : { icon: XCircle, cls: "border-red-200 bg-red-50 text-red-700" };

  const Icon = tone.icon;

  return (
    <div className={`mt-3 rounded-lg border px-3 py-2.5 ${tone.cls}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold">
          <Icon className="h-4 w-4" />
          Photo quality: {verdict.score}/100 ·{" "}
          {verdict.verdict === "pass" ? "good to inspect" : verdict.verdict === "warn" ? "workable" : "rejected"}
        </p>
        <span className="flex items-center gap-1 font-mono-scan text-[10px]">
          <Focus className="h-3 w-3" />
          {verdict.blurry ? "blur" : "sharp"} · {verdict.dark ? "dark" : "lit"}
        </span>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {verdict.reasons.map((r) => (
          <li key={r} className="text-[11px] leading-snug">
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
