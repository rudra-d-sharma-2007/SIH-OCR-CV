import type { LabelInspectionResponse, ProductLookup } from "./types";

/** Barcode → Open Food Facts via the backend proxy. */
export async function lookupProduct(code: string): Promise<ProductLookup> {
  try {
    const res = await fetch(`/api/lookup?code=${encodeURIComponent(code)}`, {
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as ProductLookup;
    return json;
  } catch (err) {
    return {
      code,
      found: false,
      note: err instanceof Error ? `Lookup failed: ${err.message}` : "Lookup failed.",
    };
  }
}

/**
 * Label photo → backend OCR + field extraction + rules engine.
 * Throws on transport failure so the UI can fall back to client-side OCR.
 */
export async function inspectLabelImage(
  image: Blob,
  code?: string
): Promise<LabelInspectionResponse> {
  const body = new FormData();
  body.append("image", image, "label.jpg");
  if (code) body.append("code", code);

  const res = await fetch("/api/scan", { method: "POST", body });
  if (!res.ok) {
    let message = `Inspection endpoint failed (${res.status}).`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      /* keep generic message */
    }
    throw new Error(message);
  }
  return (await res.json()) as LabelInspectionResponse;
}
