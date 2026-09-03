import type { OcrFields } from "../types";

/**
 * Field extraction over raw OCR text — MRP, manufacturing date, best-before,
 * expiry, FSSAI licence number, GTIN digits — plus small date helpers.
 * Pure module: imported by both the server OCR route and the browser.
 */

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTHS_FULL = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function twoDigitYear(yy: number): number {
  return yy < 70 ? 2000 + yy : 1900 + yy;
}

function monthIndex(token: string): number | null {
  const t = token.toLowerCase().replace(/[.,]/g, "");
  const full = MONTHS_FULL.indexOf(t);
  if (full !== -1) return full;
  const short = MONTHS_SHORT.findIndex((m) => m.toLowerCase() === t);
  if (short !== -1) return short;
  const match = MONTHS_FULL.findIndex((m) => m.startsWith(t) && t.length >= 3);
  return match !== -1 ? match : null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoFromParts(day: number | null, month: number, year: number): string | null {
  const y = year < 100 ? twoDigitYear(year) : year;
  if (month < 1 || month > 12 || y < 1900 || y > 2100) return null;
  if (day !== null && (day < 1 || day > 31)) return null;
  return day === null ? `${y}-${pad2(month)}` : `${y}-${pad2(month)}-${pad2(day)}`;
}

function parseNumericDate(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2}|\d{4})$/);
  if (!m) {
    const my = raw.match(/^(\d{1,2})\s*[/.\-]\s*(\d{4})$/);
    if (my) return isoFromParts(null, Number(my[1]), Number(my[2]));
    return null;
  }
  const a = Number(m[1]);
  const b = Number(m[2]);
  const year = Number(m[3]);
  if (a > 12 && b <= 12) return isoFromParts(a, b, year);
  if (b > 12 && a <= 12) return isoFromParts(b, a, year);
  return isoFromParts(a, b, year); // ambiguous → DD/MM (Indian convention)
}

function parseTextualDate(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})\s+([a-zA-Z]{3,9})\.?,?\s+(\d{2}|\d{4})$/);
  if (!m) return null;
  const month = monthIndex(m[2]);
  if (month === null) return null;
  return isoFromParts(Number(m[1]), month + 1, Number(m[3]));
}

export function displayDate(iso?: string): string | null {
  if (!iso) return null;
  const full = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    const [, y, m, d] = full;
    return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
  }
  const partial = iso.match(/^(\d{4})-(\d{2})$/);
  if (partial) {
    const [, y, m] = partial;
    return `${MONTHS_SHORT[Number(m) - 1]} ${y}`;
  }
  return iso;
}

export function dateInPast(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

interface DateHit {
  iso: string;
  raw: string;
}

function extractDateHits(text: string): DateHit[] {
  const hits: DateHit[] = [];
  const numeric =
    text.match(
      /\b\d{1,2}\s*[/.\-]\s*\d{1,2}\s*[/.\-]\s*\d{2,4}\b|\b\d{1,2}\s*[/.\-]\s*\d{4}\b/g
    ) ?? [];
  for (const token of numeric) {
    const iso = parseNumericDate(token.replace(/\s/g, ""));
    if (iso) hits.push({ iso, raw: token.trim() });
  }
  const named =
    /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+\d{2,4}\b/gi;
  let m: RegExpExecArray | null;
  while ((m = named.exec(text)) !== null) {
    const iso = parseTextualDate(m[0].replace(/\./g, " ").replace(/\s+/g, " ").trim());
    if (iso) hits.push({ iso, raw: m[0].trim() });
  }
  return hits;
}

function findFieldDate(text: string, keyword: RegExp, lines: string[]): DateHit | null {
  for (const line of lines) {
    if (!keyword.test(line)) continue;
    const lineHits = extractDateHits(line);
    if (lineHits.length > 0) return lineHits[0];
  }
  const idx = text.search(keyword);
  if (idx !== -1) {
    const windowText = text.slice(Math.max(0, idx), idx + 160);
    const hits = extractDateHits(windowText);
    if (hits.length > 0) return hits[0];
  }
  return null;
}

const MFG_KEYWORD =
  /\bmfg(?:dt|date)?\.?|\bmfd\.?|\bmanufac(?:tur(?:ed|ing))?\b|manufactur(?:ed|ing)\s*(?:date|dt)?|date of manufacture|prod\.? ?(?:date)?/i;

const BEST_BEFORE_KEYWORD = /\bbest\s*before(?:\s*end)?\b|\buse\s*by\b|\bbbe\b/i;

const EXPIRY_KEYWORD = /\bexp(?:iry)?(?:\s*date)?\.?(?![a-z])|\bexpires?\b/i;

export function parseLabelText(text: string): OcrFields {
  const normalized = text
    .replace(/[|–—]/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const whole = lines.join(" ");

  const gtinCandidates: string[] = [];
  for (const run of whole.match(/\b\d{8,14}\b/g) ?? []) {
    const clean = run.replace(/\D/g, "");
    if (clean.length === 13) gtinCandidates.push(clean);
    else if (clean.length === 14 && clean.startsWith("0")) gtinCandidates.push(clean.slice(1));
  }

  const out: OcrFields = {
    rawText: text,
    gtinCandidates: [...new Set(gtinCandidates)].slice(0, 3),
  };

  const bestBefore = findFieldDate(normalized, BEST_BEFORE_KEYWORD, lines);
  if (bestBefore) out.bestBefore = bestBefore;

  const expiry = findFieldDate(normalized, EXPIRY_KEYWORD, lines);
  if (expiry) out.expiryDate = expiry;

  const mfg = findFieldDate(normalized, MFG_KEYWORD, lines);
  if (mfg) out.mfgDate = mfg;

  const mrpMatch =
    whole.match(
      /(?:^|\s)mrp\s*(?:\([^)]*\))?\s*[:#.\-]?\s*(?:rs\.?|inr|₹)?\s*\d{1,4}(?:[.,]\d{1,2})?/i
    ) ??
    whole.match(
      /max(?:imum)?\.?\s*retail\s+price\s*[:#.\-]?\s*(?:rs\.?|inr|₹)?\s*\d{1,4}(?:[.,]\d{1,2})?/i
    );
  if (mrpMatch) {
    const amountToken =
      mrpMatch[0].match(/\d{1,4}(?:[.,]\d{1,2})/)?.[0] ?? mrpMatch[0].match(/\d{1,4}/)?.[0];
    if (amountToken) {
      out.mrp = { raw: mrpMatch[0].trim(), amount: Number(amountToken.replace(/,/g, "")) };
    }
  }

  const fssai = whole.match(/fssai[^\d]{0,24}(\d{14}|\d{11})/i);
  if (fssai) out.fssai = fssai[1];

  // Cropped close-up where the keyword itself was cut off: classify a lone
  // date by past/future — past ⇒ manufacturing, future ⇒ best-before.
  if (!out.mfgDate && !out.bestBefore && !out.expiryDate) {
    const lone = extractDateHits(normalized)[0];
    if (lone) {
      if (dateInPast(lone.iso)) out.mfgDate = lone;
      else out.bestBefore = lone;
    }
  }

  return out;
}

/**
 * Tiny on-device category guesser used when the database has no entry for the
 * scanned code — keywords seen on the label map to a food category.
 */
export function guessCategoryFromText(text: string): string | null {
  const t = text.toLowerCase();
  const groups: Array<[string, RegExp]> = [
    ["Biscuits & cookies", /biscuit|cookie|cream cracker|digestive/i],
    ["Snacks & namkeen", /chips?|namkeen|snack|popcorn|samosa|wafers/i],
    ["Chocolate & confectionery", /chocolate|candy|cadbury|toffee|lollipop|mints?/i],
    ["Breakfast cereals", /corn ?flakes|muesli|oat\b|porridge/i],
    ["Noodles, pasta & instant meals", /noodle|pasta|maggi|instant|macaroni/i],
    ["Sauces & spreads", /ketchup|sauce|mayonnaise|jam\b|peanut butter|chutney/i],
    ["Tea & coffee", /\btea\b|coffee|green tea/i],
    ["Edible oils & ghee", /refined oil|sunflower oil|mustard oil|ghee|palm oil/i],
    ["Dairy & milk products", /milk|paneer|curd|cheese|butter|yoghurt|yogurt/i],
    ["Juices & beverages", /juice|beverage|soft drink|cola|energy drink/i],
    ["Rice, atta & staples", /rice|atta|wheat|basmati|dal\b|pulses?|flour/i],
    ["Spices & masala", /masala|turmeric|chilli powder|spice|garam/i],
    ["Non-food (soap & detergent)", /soap|detergent|shampoo|toothpaste|cleaner/i],
  ];
  for (const [label, re] of groups) {
    if (re.test(t)) return label;
  }
  return null;
}
