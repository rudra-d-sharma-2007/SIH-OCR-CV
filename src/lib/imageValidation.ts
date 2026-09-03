import type { QualityVerdict } from "./types";

/**
 * Image-quality scoring for label photos.
 *
 * - Blur: mean absolute Laplacian energy of the downscaled luminance plane.
 * - Brightness: mean luma.
 * - Contrast: luma standard deviation.
 *
 * All computation happens on a tiny working copy (≤ 360 px longest side), so
 * it runs in a few milliseconds before anything is uploaded.
 */

function downsampleLuma(source: HTMLCanvasElement, maxEdge = 360): { luma: Uint8ClampedArray; w: number; h: number } {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const w = Math.max(8, Math.round(source.width * scale));
  const h = Math.max(8, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const luma = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    luma[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return { luma, w, h };
}

export function analyzeImageQuality(source: HTMLCanvasElement): QualityVerdict {
  const { luma, w, h } = downsampleLuma(source);

  // ---- statistics
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < luma.length; i++) {
    sum += luma[i];
    sumSq += luma[i] * luma[i];
  }
  const mean = sum / luma.length;
  const variance = Math.max(0, sumSq / luma.length - mean * mean);
  const stddev = Math.sqrt(variance);

  // Laplacian-ish sharpness on 3×3 interior
  let lap = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const energy = Math.abs(
        4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w]
      );
      lap += energy;
      count += 1;
    }
  }
  const lapMean = count ? lap / count : 0;

  // ---- normalized metrics (0..1)
  const sharpness = Math.min(1, lapMean / 45);
  const brightness = Math.min(1, mean / 255);
  const contrast = Math.min(1, stddev / 90);

  const blurry = sharpness < 0.22;
  const dark = mean < 72;
  const lowContrast = stddev < 22;

  const score = Math.round(
    100 * (0.55 * sharpness + 0.25 * brightness + 0.2 * contrast)
  );

  const reasons: string[] = [];
  if (blurry) reasons.push("Photo looks blurry — refocus or steady the camera.");
  if (dark) reasons.push("Too dark — labels need even, direct lighting.");
  if (lowContrast) reasons.push("Low contrast — the print may not separate from the background.");
  if (reasons.length === 0) {
    reasons.push("Focus, brightness and contrast look fine for OCR.");
  }

  let verdict: QualityVerdict["verdict"] = "pass";
  if (score < 45 || blurry || dark) verdict = "fail";
  else if (score < 62 || lowContrast) verdict = "warn";

  return { score, verdict, reasons, blurry, dark };
}
