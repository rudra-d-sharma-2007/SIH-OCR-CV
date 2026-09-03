import { NextRequest, NextResponse } from "next/server";
import { mapOffProduct, productUrl } from "@/lib/services/openFoodFacts";
import type { ProductLookup } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; lookup: ProductLookup }>();

export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get("code") ?? "").trim();

  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json({
      found: false,
      code,
      note: "Expected a numeric product code (GTIN/EAN/UPC).",
    });
  }

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.lookup, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  let lookup: ProductLookup;
  try {
    const res = await fetch(productUrl(code), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LabelScan-CV/0.2 (SIH label-inspection demo)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      lookup = { found: false, code, note: `Open Food Facts responded ${res.status}.` };
    } else {
      const json = (await res.json()) as Record<string, unknown>;
      const status = (json as { status?: number }).status ?? 0;
      if (status === 1) {
        const info = mapOffProduct(code, json);
        if (info) lookup = { found: true, code, info };
        else lookup = { found: false, code, note: "Record exists but has no product name yet." };
      } else {
        const verbose = (json as { status_verbose?: string }).status_verbose;
        lookup = { found: false, code, note: verbose ?? "Not in the Open Food Facts database." };
      }
    }
  } catch (err) {
    lookup = {
      found: false,
      code,
      note: err instanceof Error ? `Lookup failed: ${err.message}` : "Lookup failed.",
    };
  }

  cache.set(code, { at: Date.now(), lookup });
  return NextResponse.json(lookup, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
