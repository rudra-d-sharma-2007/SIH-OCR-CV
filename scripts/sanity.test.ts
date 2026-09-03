import { parseGs1, checksumValid, gtinCandidatesFromText } from "../src/lib/gs1";
import { gtin13WithCheck } from "../src/lib/barcodeDetector";
import { parseLabelText, guessCategoryFromText, displayDate } from "../src/lib/services/fieldExtraction";
import { countryPrefix } from "../src/lib/services/openFoodFacts";
import { inspectLabel } from "../src/lib/services/rulesEngine";

let failed = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log(`  ok  ${name}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}\n      got  ${g}\n      want ${w}`);
  }
}

// --- GS1 (parenthesised) ---
const a = parseGs1("(01)05449000000996(11)260101(17)270331(10)LOT-7A2");
eq("gs1 paren gtin", a?.gtin, "5449000000996");
eq("gs1 paren mfg", a?.mfgDateIso, "2026-01-01");
eq("gs1 paren expiry", a?.expiryIso, "2027-03-31");
eq("gs1 paren batch", a?.batch, "LOT-7A2");

// --- GS1 (bare/FNC-less, header-prefixed) ---
const b = parseGs1("]Q101089012345678911126071510LOT-9");
eq("gs1 bare gtin", b?.gtin, "8901234567891");
eq("gs1 bare mfg", b?.mfgDateIso, "2026-07-15");
eq("gs1 bare batch", b?.batch, "LOT-9");

// --- plain EAN must NOT be misread as GS1 ---
eq("plain ean not gs1", parseGs1("8901234567891"), null);

// --- checksum ---
eq("checksum coca", checksumValid("5449000000996"), true);
eq("checksum bad", checksumValid("5449000000991"), false);
const sample = gtin13WithCheck("890103012345");
eq("gtin13WithCheck length", sample.length, 13);
eq("gtin13WithCheck valid", checksumValid(sample), true);

// --- candidates ---
eq("candidates from URL", gtinCandidatesFromText("https://p.scan.me/5449000000996?x=1"), [
  "5449000000996",
]);
eq("candidates upc12", gtinCandidatesFromText("012345678905"), ["0012345678905"]);

// --- OCR label parsing ---
const label = [
  "GLUCOSE BISCUITS",
  "MRP (incl. of all taxes): Rs. 40.00",
  "Mfg Date: 12/08/2026",
  "Best Before: 12/08/2027",
  "FSSAI Lic No: 10018012000123",
  "Net wt: 200 g",
  "8901030123451",
].join("\n");
const ocr = parseLabelText(label);
eq("ocr mfg", ocr.mfgDate?.iso, "2026-08-12");
eq("ocr bestBefore", ocr.bestBefore?.iso, "2027-08-12");
eq("ocr mrp", ocr.mrp?.amount, 40);
eq("ocr fssai", ocr.fssai, "10018012000123");
eq("ocr gtin", ocr.gtinCandidates, ["8901030123451"]);
eq("display date", displayDate("2026-07-15"), "15 Jul 2026");

// --- category guess ---
eq("guess biscuit", guessCategoryFromText("Glucose biscuits cream"), "Biscuits & cookies");
eq("guess none", guessCategoryFromText("xqzz 88"), null);

// --- country prefix ---
eq("india prefix", countryPrefix("8901030123451"), "India");
eq("belgium prefix", countryPrefix("5449000000996"), "Belgium & Luxembourg");

// --- rules engine ---
const compliant = inspectLabel({
  text: label,
  fields: ocr,
});
const byId = Object.fromEntries(compliant.map((v) => [v.id, v.status]));
eq("rules mrp ok", byId.mrp_declared, "ok");
eq("rules fssai ok", byId.fssai_licence, "ok");
eq("rules date marks ok", byId.date_marks, "ok");
eq("rules no critical", compliant.some((v) => v.status === "critical"), false);

const expired = inspectLabel({
  text: "MRP: Rs. 10\nBest Before: 12/08/2020\nFSSAI 10018012000123",
  fields: parseLabelText("MRP: Rs. 10\nBest Before: 12/08/2020\nFSSAI 10018012000123"),
});
eq("rules expired flagged", expired.some((v) => v.id === "expiry_past" && v.status === "critical"), true);

const banned = inspectLabel({
  text: "Ingredients: wheat flour, potassium bromate",
  fields: parseLabelText("Ingredients: wheat flour, potassium bromate"),
});
eq("rules banned flagged", banned.some((v) => v.id === "banned_potassium_bromate"), true);

if (failed) {
  console.log(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll sanity checks passed");
