import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  MultiFormatWriter,
  RGBLuminanceSource,
} from "@zxing/library";
import type { DecodeHit } from "./types";

/**
 * Computer-vision decode of QR codes and 1D/2D barcodes (EAN-13/8, UPC-A/E,
 * Code 128/39/93, ITF, Data Matrix, PDF-417, Aztec …) using ZXing on raw
 * canvas pixels. Several luminance preprocessings (plain, contrast-stretched,
 * inverted) × two binarizers are tried so glossy/dark packaging still decodes.
 */

const READ_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.AZTEC,
  BarcodeFormat.PDF_417,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.ITF,
];

const FORMAT_LABELS: Partial<Record<BarcodeFormat, string>> = {
  [BarcodeFormat.QR_CODE]: "QR Code",
  [BarcodeFormat.DATA_MATRIX]: "Data Matrix",
  [BarcodeFormat.AZTEC]: "Aztec",
  [BarcodeFormat.PDF_417]: "PDF417",
  [BarcodeFormat.EAN_13]: "EAN-13",
  [BarcodeFormat.EAN_8]: "EAN-8",
  [BarcodeFormat.UPC_A]: "UPC-A",
  [BarcodeFormat.UPC_E]: "UPC-E",
  [BarcodeFormat.CODE_128]: "Code 128",
  [BarcodeFormat.CODE_39]: "Code 39",
  [BarcodeFormat.CODE_93]: "Code 93",
  [BarcodeFormat.CODABAR]: "Codabar",
  [BarcodeFormat.ITF]: "ITF-14",
};

export function formatLabel(format: BarcodeFormat): string {
  return FORMAT_LABELS[format] ?? BarcodeFormat[format] ?? "Code";
}

function makeHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, READ_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

function luminanceSets(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): { plain: Uint8ClampedArray; stretched: Uint8ClampedArray; inverted: Uint8ClampedArray } {
  const n = width * height;
  const plain = new Uint8ClampedArray(n);
  const stretched = new Uint8ClampedArray(n);
  const inverted = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const l = (r * 299 + g * 587 + b * 114) / 1000;
    plain[j] = l;
    let s = 128 + (l - 128) * 1.55;
    s = s < 0 ? 0 : s > 255 ? 255 : s;
    stretched[j] = s;
    inverted[j] = 255 - l;
  }
  return { plain, stretched, inverted };
}

function attempt(
  luminances: Uint8ClampedArray,
  width: number,
  height: number,
  Binarizer: typeof HybridBinarizer | typeof GlobalHistogramBinarizer,
  reader: MultiFormatReader
): DecodeHit | null {
  try {
    const source = new RGBLuminanceSource(luminances, width, height);
    const bitmap = new BinaryBitmap(new Binarizer(source));
    const result = reader.decode(bitmap);
    const text = result.getText();
    if (!text) return null;
    return { text, format: formatLabel(result.getBarcodeFormat()) };
  } catch {
    return null;
  }
}

export function decodeCanvas(
  canvas: HTMLCanvasElement,
  opts: { fast?: boolean } = {}
): DecodeHit | null {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height || width * height < 1600) return null;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, width, height);
  const lumas = luminanceSets(image.data, width, height);
  const reader = new MultiFormatReader();
  reader.setHints(makeHints());

  const combos: Array<
    [Uint8ClampedArray, typeof HybridBinarizer | typeof GlobalHistogramBinarizer]
  > = opts.fast
    ? [[lumas.plain, HybridBinarizer]]
    : [
        [lumas.plain, HybridBinarizer],
        [lumas.plain, GlobalHistogramBinarizer],
        [lumas.stretched, HybridBinarizer],
        [lumas.stretched, GlobalHistogramBinarizer],
        [lumas.inverted, HybridBinarizer],
        [lumas.inverted, GlobalHistogramBinarizer],
      ];

  for (const [arr, Binarizer] of combos) {
    const hit = attempt(arr, width, height, Binarizer, reader);
    if (hit) return hit;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sample-label generators (EAN-13 + GS1 QR) for demoing without a printer.
// ---------------------------------------------------------------------------

export function gtin13WithCheck(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(first12[i]);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${first12}${check}`;
}

function renderMatrix(
  canvas: HTMLCanvasElement,
  matrix: { get(x: number, y: number): boolean; getWidth(): number; getHeight(): number },
  scale: number,
  pad: number
) {
  const mw = matrix.getWidth();
  const mh = matrix.getHeight();
  canvas.width = mw * scale + pad * 2;
  canvas.height = mh * scale + pad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (matrix.get(x, y)) ctx.fillRect(pad + x * scale, pad + y * scale, scale, scale);
    }
  }
}

export function makeEanSampleCanvas(first12 = "890103012345"): HTMLCanvasElement {
  const code = gtin13WithCheck(first12);
  const writer = new MultiFormatWriter();
  const matrix = writer.encode(code, BarcodeFormat.EAN_13, 95, 72, new Map());
  const canvas = document.createElement("canvas");
  renderMatrix(canvas, matrix, 3, 28);
  return canvas;
}

export function makeGs1QrSampleCanvas(): HTMLCanvasElement {
  const payload = "(01)05449000000996(11)260101(17)270331(10)LOT-7A2";
  const writer = new MultiFormatWriter();
  const matrix = writer.encode(payload, BarcodeFormat.QR_CODE, 41, 41, new Map());
  const canvas = document.createElement("canvas");
  renderMatrix(canvas, matrix, 6, 24);
  return canvas;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.92): string {
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return canvas.toDataURL();
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Draws any image source onto a fresh canvas bounded to maxEdge (longest side). */
export function fitImageToCanvas(
  source: { width: number; height: number },
  maxEdge = 1600
): HTMLCanvasElement {
  const sw = source.width ?? 0;
  const sh = source.height ?? 0;
  if (!sw || !sh) throw new Error("Empty image source");
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function loadFileAsCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(fitImageToCanvas(img));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode that image file"));
    };
    img.src = url;
  });
}
