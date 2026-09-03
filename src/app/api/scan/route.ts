import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectLabel } from "@/lib/services/rulesEngine";
import { parseLabelText } from "@/lib/services/fieldExtraction";
import { mapOffProduct, productUrl } from "@/lib/services/openFoodFacts";
import type { LabelInspectionResponse, ProductInfo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Server-side Tesseract worker (shared across requests, first use downloads
// the `eng` traineddata from the jsDelivr CDN).
// ---------------------------------------------------------------------------

let workerPromise: Promise<unknown> | null = null;

type OcrLike = {
  recognize: (image: string, options?: Record<string, boolean>) => Promise<{ data: { text: string } }>;
};

async function getWorker(): Promise<OcrLike> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("eng", 1, { logger: () => undefined })
    );
  }
  return (await workerPromise) as OcrLike;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function lookupOfflineProduct(code: string): Promise<ProductInfo | null> {
  try {
    const res = await fetch(productUrl(code), {
      headers: { Accept: "application/json", "User-Agent": "LabelScan-CV/0.2 (SIH demo)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    if ((json as { status?: number }).status !== 1) return null;
    return mapOffProduct(code, json);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let tmpPath: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("image");
    const codeParam = String(form.get("code") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'image' file in the request." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "The uploaded file must be an image." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    tmpPath = path.join(os.tmpdir(), `labellens-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
    await fs.writeFile(tmpPath, buffer);

    const worker = await getWorker();
    const result = await worker.recognize(tmpPath, {
      text: true,
      blocks: false,
      layoutBlocks: false,
      hocr: false,
      tsv: false,
      box: false,
      unlv: false,
      sd: false,
      pdf: false,
    });
    const text = (result.data.text ?? "").trim();

    const fields = text.length > 3 ? parseLabelText(text) : null;

    // Optional enrichment when the client already decoded a barcode/QR.
    let product: ProductInfo | null = null;
    if (/^\d{6,14}$/.test(codeParam)) {
      product = await lookupOfflineProduct(codeParam);
    } else if (fields?.gtinCandidates.length) {
      product = await lookupOfflineProduct(fields.gtinCandidates[0]);
    }

    const violations = inspectLabel({ text, fields, product });

    const payload: LabelInspectionResponse = {
      text,
      fields,
      product: product
        ? { found: true, code: product.code, info: product }
        : null,
      violations,
      note: text.length <= 3 ? "No readable printed text was found on this label." : undefined,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? `OCR pipeline failed: ${err.message}` : "OCR pipeline failed." },
      { status: 500 }
    );
  } finally {
    if (tmpPath) await fs.unlink(tmpPath).catch(() => undefined);
  }
}
