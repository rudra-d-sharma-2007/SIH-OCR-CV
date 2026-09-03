import type { Gs1Fields } from "./types";

/**
 * GS1 Application Identifier parsing. Modern packaged-food QRs (GS1
 * Digital-Link / GS1-128 style payloads) carry the real answers we need:
 *
 *   (01) GTIN · (10) batch · (11) production date · (15) best before ·
 *   (17) expiry · (21) serial …
 *
 * Parenthesised form, e.g. "(01)08901234567891(17)270630(10)LOT-7",
 * as well as FNC1-separated / bare concatenated forms are both handled.
 */

const FIXED_AIS: Record<string, number> = {
  "01": 14,
  "02": 14,
  "11": 6,
  "12": 6,
  "13": 6,
  "15": 6,
  "16": 6,
  "17": 6,
  "20": 2,
};

const VARIABLE_AIS = new Set([
  "10",
  "21",
  "30",
  "37",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
]);

interface AiEntry {
  ai: string;
  value: string;
}

function yymmddToIso(value: string): string | null {
  const m = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const yy = Number(m[1]);
  const mo = Number(m[2]);
  const dd = Number(m[3]);
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  const year = yy < 70 ? 2000 + yy : 1900 + yy;
  return `${year}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function gtin13FromAi01(value: string): string | undefined {
  // AI (01) values are 14 digits, usually with a leading 0 that pads a GTIN-13.
  let digits = value.replace(/\D/g, "");
  if (digits.length < 13) return undefined;
  if (digits.length === 14 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 13 ? digits : undefined;
}

const GS1_HEADERS = ["]Q1", "]d2", "]C1", "]e0", "]Q3", "]Q2"];

export function parseGs1(raw: string): Gs1Fields | null {
  if (!raw) return null;
  let text = raw.replace(/\u001d/g, "").trim();
  // Strip the GS1 symbology headers ("]Q1" QR, "]d2" Data Matrix, "]C1" GS1-128 …).
  for (const header of GS1_HEADERS) {
    if (text.startsWith(header)) {
      text = text.slice(header.length);
      break;
    }
  }
  text = text.replace(/^\u001d/, "").trim();

  const entries: AiEntry[] = [];

  if (text.includes("(")) {
    const re = /\((\d{2,4})\)([^()]*?)(?=\(\d{2,4}\)|$)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = match[2].replace(/\u001d/g, "").trim();
      if (value) entries.push({ ai: match[1], value });
    }
  } else {
    // Bare concatenated payload: walk known AIs in order.
    // (FSSAI/FoSCoS QRs often look like "010890…17…10LOT" with no parens.)
    let i = 0;
    let rest = text;
    while (rest.length >= 2) {
      const ai = rest.slice(0, 2);
      if (FIXED_AIS[ai] !== undefined && rest.length >= 2 + FIXED_AIS[ai]) {
        entries.push({ ai, value: rest.slice(2, 2 + FIXED_AIS[ai]) });
        rest = rest.slice(2 + FIXED_AIS[ai]);
      } else if (VARIABLE_AIS.has(ai)) {
        const sep = rest.indexOf("\u001d");
        const take = sep === -1 ? rest.slice(2) : rest.slice(2, sep);
        entries.push({ ai, value: take });
        rest = "";
      } else {
        // Two stray digits that aren't a known AI — stop parsing.
        break;
      }
      i += 1;
      if (i > 30) break;
    }
  }

  if (entries.length === 0) return null;

  const out: Gs1Fields = { raw };
  for (const { ai, value } of entries) {
    switch (ai) {
      case "01":
        out.gtin = gtin13FromAi01(value);
        break;
      case "10":
        out.batch = value;
        break;
      case "21":
        out.serial = value;
        break;
      case "11":
        out.mfgDateIso = yymmddToIso(value) ?? out.mfgDateIso;
        break;
      case "13":
        out.packDateIso = yymmddToIso(value) ?? out.packDateIso;
        break;
      case "15":
        out.bestBeforeIso = yymmddToIso(value) ?? out.bestBeforeIso;
        break;
      case "17":
        out.expiryIso = yymmddToIso(value) ?? out.expiryIso;
        break;
      default:
        break;
    }
  }

  const hasAnything = Boolean(
    out.gtin || out.batch || out.serial || out.mfgDateIso || out.packDateIso ||
      out.bestBeforeIso || out.expiryIso
  );
  return hasAnything ? out : null;
}

/** GTIN / EAN-13 check digit validation (weights 1·3·1·3… from the left). */
export function checksumValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(clean)) return true; // don't block unvalidatable forms
  if (clean.length === 8 || clean.length === 14) return true; // ITF-14/EAN-8 weightings differ
  let sum = 0;
  for (let i = 0; i < clean.length; i++) {
    sum += Number(clean[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/** Turns a raw scan / OCR digit string into plausible GTIN candidates. */
export function gtinCandidatesFromText(rawText: string): string[] {
  const digits = rawText.replace(/\D/g, "");
  const out = new Set<string>();
  const tryAdd = (c: string) => {
    if (out.size < 3) out.add(c);
  };
  if (/^\d{14}$/.test(digits)) {
    if (digits.startsWith("0")) {
      tryAdd(digits.slice(1)); // 0-padded GTIN-13
    } else {
      // ITF-14 / GS1-128 style, or a 13-digit run with a stray trailing digit.
      const head = digits.slice(0, 13);
      const tail = digits.slice(1);
      const headOk = checksumValid(head);
      const tailOk = checksumValid(tail);
      if (headOk) tryAdd(head);
      if (tailOk && !headOk) tryAdd(tail);
      if (!headOk && !tailOk) tryAdd(digits);
    }
  } else if (/^\d{13}$/.test(digits)) {
    tryAdd(digits);
  } else if (/^\d{12}$/.test(digits)) {
    tryAdd(`0${digits}`); // UPC-A → GTIN-13
  } else if (/^\d{8}$/.test(digits)) {
    tryAdd(digits); // EAN-8
  }
  if (out.size === 0) {
    // Long free text (URLs, OCR) — pull out digit runs with valid checksums.
    for (const run of rawText.match(/\d{13,14}/g) ?? []) {
      if (run.length === 14 && run.startsWith("0")) {
        const candidate = run.slice(1);
        if (checksumValid(candidate)) out.add(candidate);
      } else if (run.length === 14) {
        // trailing stray digit may belong to a query param — try the first 13
        const head = run.slice(0, 13);
        const tail = run.slice(1);
        const headOk = checksumValid(head);
        const tailOk = checksumValid(tail);
        if (headOk) out.add(head);
        if (tailOk && !headOk) out.add(tail);
        if (!headOk && !tailOk) out.add(run);
      } else if (checksumValid(run)) {
        out.add(run);
      }
    }
  }
  return [...out].slice(0, 3);
}
