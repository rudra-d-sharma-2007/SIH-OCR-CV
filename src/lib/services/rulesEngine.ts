import type { Gs1Fields, OcrFields, ProductInfo, Violation } from "../types";
import { dateInPast } from "./fieldExtraction";
import legalMetrologyRules from "../../data/legalMetrologyRules.json";
import bannedSubstances from "../../data/bannedSubstances.json";

interface Rule {
  id: string;
  title: string;
  requirement: string;
  reference: string;
  severity: "critical" | "warn";
}

interface BannedSubstance {
  id: string;
  name: string;
  keywords: string[];
  restriction: string;
  reference: string;
  severity: "critical" | "warn";
}

const RULES = legalMetrologyRules as Rule[];
const BANNED = bannedSubstances as BannedSubstance[];

export interface InspectInput {
  text: string;
  fields: OcrFields | null;
  gs1?: Gs1Fields | null;
  product?: ProductInfo | null;
}

const FUTURE_SLACK_MS = 30 * 24 * 3600 * 1000;

export function inspectLabel(input: InspectInput): Violation[] {
  const text = input.text ?? "";
  const normalized = ` ${text.toLowerCase()} `;
  const fields = input.fields;
  const gs1 = input.gs1;

  const hasMfgDate = Boolean(fields?.mfgDate || gs1?.mfgDateIso || gs1?.packDateIso);
  const hasExpiryDate = Boolean(fields?.expiryDate || gs1?.expiryIso);
  const hasBestBefore = Boolean(fields?.bestBefore || gs1?.bestBeforeIso);
  const hasAnyDate = hasMfgDate || hasExpiryDate || hasBestBefore;

  const mfgIso = fields?.mfgDate?.iso ?? gs1?.mfgDateIso ?? gs1?.packDateIso;
  const expiryIso = fields?.expiryDate?.iso ?? gs1?.expiryIso ?? gs1?.bestBeforeIso ?? fields?.bestBefore?.iso;

  const present: Record<string, boolean> = {
    name_of_food: /[a-z]{4,}/i.test(text) && text.trim().length >= 12,
    mrp_declared: Boolean(fields?.mrp),
    net_quantity: /(net\s*(?:wt\.?|weight|qty|quantity|content|mrp.?declared))|net\.?\s*[:.]/i.test(normalized),
    manufacturer_details: /(manufactur|packed\s*by|packer|mfd\s*by|imported\s*by|distribut)/i.test(
      normalized
    ),
    date_marks: hasAnyDate,
    consumer_care: /(customer|consumer)\s*care|toll\s*free|complaint|care\s*[@:]/i.test(normalized),
    fssai_licence: Boolean(fields?.fssai),
    ingredients_list: /ingredients?\s*[:]/i.test(normalized),
    vegetarian_mark: /(?:veg(?:etarian)?|non[- ]?veg|pure\s*veg)/i.test(normalized),
  };

  const violations: Violation[] = [];

  for (const rule of RULES) {
    if (rule.id === "expiry_not_past") {
      // handled below with real date comparison
      continue;
    }
    const seen = present[rule.id];
    if (rule.id === "name_of_food" && !seen) continue; // text always has *some* words
    if (seen) {
      violations.push({
        id: rule.id,
        status: "ok",
        title: rule.title,
        detail: evidence(rule.id, fields),
        reference: rule.reference,
        source: "rules",
      });
    } else {
      violations.push({
        id: rule.id,
        status: "warn",
        title: rule.title,
        detail:
          "Not detected in this photo. Verify on the physical label — retake as a flat, full-front close-up if it was cropped.",
        reference: rule.reference,
        source: "rules",
      });
    }
  }

  // Expiry / best-before enforcement
  if (expiryIso) {
    if (dateInPast(expiryIso)) {
      violations.push({
        id: "expiry_past",
        status: "critical",
        title: "Product appears past its expiry / best-before date",
        detail: `Dated ${expiryIso} — this is before today. If the date was read correctly the product should not be sold.`,
        reference: "Enforcement check (FSSAI + LM)",
        source: "rules",
      });
    } else {
      violations.push({
        id: "expiry_not_past",
        status: "ok",
        title: "Expiry date in the future",
        detail: `Read as ${expiryIso}.`,
        reference: "Enforcement check (FSSAI + LM)",
        source: "rules",
      });
    }
  }

  // Manufacturing date should not be in the future
  if (mfgIso) {
    const mfgMs = new Date(`${mfgIso}T00:00:00`).getTime();
    if (!Number.isNaN(mfgMs) && mfgMs > Date.now() + FUTURE_SLACK_MS) {
      violations.push({
        id: "mfg_date_future",
        status: "warn",
        title: "Manufacturing date is in the future",
        detail: `Read as ${mfgIso} — double-check the date format (day/month vs month/day).`,
        source: "rules",
      });
    }
  }

  // Banned / restricted substances appearing on the label
  for (const sub of BANNED) {
    const hit = sub.keywords.find((k) => normalized.includes(k.toLowerCase()));
    if (!hit) continue;
    violations.push({
      id: `banned_${sub.id}`,
      status: sub.severity,
      title: `${sub.name} appears on the label`,
      detail: `${sub.restriction} (keyword "${hit}" matched in OCR text).`,
      reference: sub.reference,
      source: "rules",
    });
  }
  return violations;
}

function evidence(ruleId: string, fields: OcrFields | null): string {
  if (!fields) return "Detected in the label text.";
  switch (ruleId) {
    case "mrp_declared":
      return fields.mrp
        ? `MRP read from the label: ₹${fields.mrp.amount} (saw "${fields.mrp.raw}").`
        : "MRP declared on the label.";
    case "fssai_licence":
      return fields.fssai
        ? `FSSAI licence number read: ${fields.fssai}.`
        : "FSSAI licence present.";
    case "date_marks":
      const parts: string[] = [];
      if (fields.mfgDate) parts.push(`mfg ${fields.mfgDate.iso}`);
      if (fields.expiryDate) parts.push(`expiry ${fields.expiryDate.iso}`);
      if (fields.bestBefore) parts.push(`best before ${fields.bestBefore.iso}`);
      return parts.length ? `Date marks read: ${parts.join(", ")}.` : "Date mark present on label.";
    default:
      return "Detected in the label text.";
  }
}
