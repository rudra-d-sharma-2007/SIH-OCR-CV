import type { ProductInfo } from "../types";

/** Talks to Open Food Facts — pure helpers used by the /api/lookup route. */

export const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

export const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "brands_tags",
  "categories",
  "categories_tags",
  "quantity",
  "packaging",
  "manufacturing_places",
  "origins",
  "origins_tags",
  "countries",
  "countries_tags",
  "image_front_url",
  "image_url",
  "ingredients_text",
  "ingredients_text_en",
  "allergens_tags",
  "additives_tags",
  "labels_tags",
  "nova_group",
  "nutriscore_grade",
  "ecoscore_grade",
].join(",");

export function productUrl(code: string): string {
  return `${OFF_BASE}/${code}.json?fields=${encodeURIComponent(OFF_FIELDS)}`;
}

type Json = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  if (typeof v === "number") return String(v);
  return undefined;
}

function tagList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  const s = str(v);
  return s ? [s] : [];
}

function listFromCsv(v: unknown): string[] {
  const s = str(v);
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function mapOffProduct(code: string, raw: Json): ProductInfo | null {
  const product = (raw.product ?? raw) as Json;
  const name =
    str(product.product_name) ?? str(product.product_name_en) ?? str(product.generic_name);
  if (!name) return null;

  return {
    code,
    name,
    brands: listFromCsv(product.brands),
    categories: listFromCsv(product.categories).slice(0, 8),
    categoryTags: tagList(product.categories_tags).map((t) => t.replace(/^(en|in|fr|de|es):/, "")),
    quantity: str(product.quantity),
    packaging: str(product.packaging) ?? "",
    manufacturingPlaces: str(product.manufacturing_places) ?? "",
    origins: str(product.origins) ?? "",
    countries: tagList(product.countries_tags).map((t) => t.replace(/^[a-z]{2}:/, "")),
    imageUrl: str(product.image_front_url) ?? str(product.image_url),
    ingredients: str(product.ingredients_text_en) ?? str(product.ingredients_text),
    allergens: tagList(product.allergens_tags).map((t) => t.replace(/^[a-z]{2}:/, "")),
    additives: tagList(product.additives_tags).map((t) => t.replace(/^[a-z]{2}:/, "")),
    labels: tagList(product.labels_tags).map((t) => t.replace(/^[a-z]{2}:/, "")).slice(0, 8),
    novaGroup: str(product.nova_group),
    nutriscore: str(product.nutriscore_grade),
    ecoscore: str(product.ecoscore_grade),
    codeCountry: countryPrefix(code),
  };
}

// ---------------------------------------------------------------------------
// GS1 prefix → likely country of manufacture (from the barcode itself).
// ---------------------------------------------------------------------------

const PREFIXES: Array<[number, number, string]> = [
  [0, 19, "US/Canada (North America)"],
  [30, 37, "France"],
  [380, 380, "Bulgaria"],
  [383, 383, "Slovenia"],
  [385, 385, "Croatia"],
  [387, 387, "Bosnia & Herzegovina"],
  [400, 440, "Germany"],
  [450, 459, "Japan"],
  [460, 469, "Russia"],
  [470, 470, "Kyrgyzstan"],
  [471, 471, "Taiwan"],
  [474, 474, "Estonia"],
  [475, 475, "Latvia"],
  [477, 477, "Lithuania"],
  [479, 479, "Sri Lanka"],
  [480, 480, "Philippines"],
  [481, 481, "Belarus"],
  [484, 484, "Moldova"],
  [485, 485, "Armenia"],
  [486, 486, "Georgia"],
  [487, 487, "Kazakhstan"],
  [489, 489, "Hong Kong"],
  [490, 499, "Japan"],
  [500, 509, "United Kingdom"],
  [520, 521, "Greece"],
  [528, 528, "Lebanon"],
  [529, 529, "Cyprus"],
  [531, 531, "North Macedonia"],
  [535, 535, "Malta"],
  [539, 539, "Ireland"],
  [540, 549, "Belgium & Luxembourg"],
  [560, 560, "Portugal"],
  [569, 569, "Iceland"],
  [570, 579, "Denmark"],
  [590, 590, "Poland"],
  [594, 594, "Romania"],
  [599, 599, "Hungary"],
  [600, 601, "South Africa"],
  [603, 603, "Ghana"],
  [608, 608, "Bahrain"],
  [609, 609, "Mauritius"],
  [611, 611, "Morocco"],
  [613, 613, "Algeria"],
  [616, 616, "Kenya"],
  [618, 618, "Ivory Coast"],
  [619, 619, "Tunisia"],
  [621, 622, "Syria"],
  [624, 624, "Libya"],
  [625, 625, "Jordan"],
  [626, 626, "Iran"],
  [627, 627, "Kuwait"],
  [628, 628, "Saudi Arabia"],
  [629, 629, "UAE"],
  [640, 649, "Finland"],
  [690, 699, "China"],
  [700, 709, "Norway"],
  [729, 729, "Israel"],
  [730, 739, "Sweden"],
  [740, 745, "Guatemala–El Salvador"],
  [746, 746, "Dominican Republic"],
  [750, 750, "Mexico"],
  [754, 755, "Canada"],
  [759, 759, "Venezuela"],
  [760, 769, "Switzerland"],
  [770, 771, "Colombia"],
  [773, 773, "Uruguay"],
  [775, 775, "Peru"],
  [777, 777, "Bolivia"],
  [779, 779, "Argentina"],
  [780, 780, "Chile"],
  [784, 784, "Paraguay"],
  [786, 786, "Ecuador"],
  [789, 790, "Brazil"],
  [800, 839, "Italy"],
  [840, 849, "Spain"],
  [850, 850, "Cuba"],
  [858, 858, "Slovakia"],
  [859, 859, "Czech Republic"],
  [860, 869, "Serbia"],
  [867, 867, "North Korea"],
  [868, 869, "Turkey"],
  [870, 879, "Netherlands"],
  [880, 880, "South Korea"],
  [885, 885, "Thailand"],
  [888, 888, "Singapore"],
  [890, 890, "India"],
  [893, 893, "Vietnam"],
  [896, 896, "Pakistan"],
  [899, 899, "Indonesia"],
  [900, 919, "Austria"],
  [930, 939, "Australia"],
  [940, 949, "New Zealand"],
  [950, 950, "Papua New Guinea"],
  [955, 955, "Malaysia"],
  [958, 958, "Macau"],
  [960, 969, "United Kingdom (GTIN-8)"],
  [977, 977, "Serbia"],
  [978, 979, "Books (ISBN)"],
];

export function countryPrefix(code: string): string | undefined {
  const digits = code.replace(/\D/g, "");
  if (digits.length < 2) return undefined;
  const prefix = Number(digits.slice(0, 3));
  for (const [lo, hi, label] of PREFIXES) {
    if (prefix >= lo && prefix <= hi) return label;
  }
  const two = Number(digits.slice(0, 2));
  for (const [lo, hi, label] of PREFIXES) {
    if (two >= lo && two <= hi) return label;
  }
  return undefined;
}
