// Shared TypeScript types for the OCR/CV inspection flow.

export interface DecodeHit {
  text: string;
  format: string;
}

export interface Gs1Fields {
  gtin?: string;
  batch?: string;
  serial?: string;
  mfgDateIso?: string; // AI (11)
  packDateIso?: string; // AI (13)
  bestBeforeIso?: string; // AI (15)
  expiryIso?: string; // AI (17)
  raw: string;
}

export interface OcrFields {
  mfgDate?: { raw: string; iso: string };
  expiryDate?: { raw: string; iso: string };
  bestBefore?: { raw: string; iso: string };
  mrp?: { raw: string; amount: number };
  fssai?: string;
  gtinCandidates: string[];
  rawText: string;
}

export interface ProductInfo {
  code: string;
  name: string;
  brands: string[];
  categories: string[];
  categoryTags: string[];
  quantity?: string;
  packaging: string;
  manufacturingPlaces: string;
  origins: string;
  countries: string[];
  imageUrl?: string;
  ingredients?: string;
  allergens: string[];
  additives: string[];
  labels: string[];
  novaGroup?: string;
  nutriscore?: string;
  ecoscore?: string;
  codeCountry?: string;
}

export interface ProductLookup {
  code: string;
  found: boolean;
  info?: ProductInfo;
  note?: string;
}

export type ViolationStatus = "critical" | "warn" | "ok" | "info";

export interface Violation {
  id: string;
  status: ViolationStatus;
  title: string;
  detail: string;
  reference?: string;
  source?: string; // where the evidence came from: gs1 | ocr | db | rules
}

export interface QualityVerdict {
  score: number; // 0..100
  verdict: "pass" | "warn" | "fail";
  reasons: string[];
  blurry: boolean;
  dark: boolean;
}

export interface ScanReport {
  id: string;
  kind: "barcode" | "label";
  at: number;
  code?: string;
  format?: string;
  raw?: string;
  gs1?: Gs1Fields | null;
  product?: ProductLookup | null;
  fields?: OcrFields | null;
  violations: Violation[];
  quality?: QualityVerdict;
  note?: string;
}

export interface HistoryEntry {
  id: string;
  at: number;
  code?: string;
  format?: string;
  name?: string;
  category?: string;
  mfgDate?: string;
}

export interface LookupResponse {
  found: boolean;
  code: string;
  info?: ProductInfo;
  note?: string;
}

export interface LabelInspectionResponse {
  text: string;
  fields: OcrFields | null;
  product?: ProductLookup | null;
  violations: Violation[];
  note?: string;
}
