"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Barcode,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Info,
  MapPin,
  Package,
  ShieldAlert,
  ShieldCheck,
  Tags,
} from "lucide-react";
import type { ScanReport, Violation } from "@/lib/types";
import { displayDate } from "@/lib/services/fieldExtraction";

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-paper text-ink-soft",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-orange-200 bg-orange-50 text-orange-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono-scan text-[10px] font-bold ${tones[tone] ?? tones.neutral}`}
    >
      {children}
    </span>
  );
}

function AnswerCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-parchment p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-1.5 text-sm font-black leading-snug text-ink">{value}</div>
      <div className="mt-1 text-[10px] font-medium leading-snug text-ink-soft">{sub}</div>
    </div>
  );
}

function categoryOf(r: ScanReport): { value: string; sub: string } {
  const info = r.product?.info;
  if (info?.categories.length) return { value: info.categories.join(" · "), sub: "Open Food Facts category tree" };
  if (info?.categoryTags.length) return { value: info.categoryTags.join(" · "), sub: "Open Food Facts tags" };
  if (r.product?.found) return { value: "No category on record", sub: "Entry lacks a category" };
  return { value: "Not determined", sub: "Scan a barcode/QR or inspect the label text" };
}

function locationOf(r: ScanReport): { value: string; sub: string } {
  const info = r.product?.info;
  if (info?.manufacturingPlaces) return { value: info.manufacturingPlaces, sub: "Open Food Facts · manufacturing places" };
  if (info?.origins) return { value: info.origins, sub: "Open Food Facts · origins" };
  if (info?.codeCountry) return { value: info.codeCountry, sub: "GS1 prefix of the scanned code" };
  if (r.product && !r.product.found) return { value: "See note", sub: "GTIN not in database" };
  return { value: "Not determined", sub: "Barcodes don't encode origin — GS1 QR or label OCR can" };
}

function mfgOf(r: ScanReport): { value: string; sub: string } {
  if (r.gs1?.mfgDateIso) return { value: displayDate(r.gs1.mfgDateIso) ?? "", sub: "GS1 QR field (11)" };
  if (r.fields?.mfgDate) return { value: displayDate(r.fields.mfgDate.iso) ?? "", sub: "OCR of the printed label" };
  return { value: "Not on the code", sub: "Plain barcodes carry no dates — GS1 QR or label OCR reveals them" };
}

function expiryOf(r: ScanReport): { value: string; sub: string } {
  if (r.gs1?.expiryIso) return { value: displayDate(r.gs1.expiryIso) ?? "", sub: "Expiry · GS1 QR (17)" };
  if (r.gs1?.bestBeforeIso) return { value: displayDate(r.gs1.bestBeforeIso) ?? "", sub: "Best before · GS1 QR (15)" };
  if (r.fields?.expiryDate) return { value: displayDate(r.fields.expiryDate.iso) ?? "", sub: "Expiry · OCR" };
  if (r.fields?.bestBefore) return { value: displayDate(r.fields.bestBefore.iso) ?? "", sub: "Best before · OCR" };
  return { value: "Not found", sub: "Check the printed expiry / best-before on the label" };
}

const STATUS_META: Record<Violation["status"], { icon: React.ReactNode; row: string; chip: string }> = {
  critical: { icon: <ShieldAlert className="h-4 w-4 text-red-600" />, row: "border-red-200 bg-red-50/70", chip: "border-red-200 bg-red-100 text-red-800" },
  warn: { icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, row: "border-amber-200 bg-amber-50/70", chip: "border-amber-200 bg-amber-100 text-amber-800" },
  ok: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />, row: "border-emerald-200 bg-emerald-50/50", chip: "border-emerald-200 bg-emerald-100 text-emerald-800" },
  info: { icon: <Info className="h-4 w-4 text-sky-600" />, row: "border-sky-200 bg-sky-50/60", chip: "border-sky-200 bg-sky-100 text-sky-800" },
};

function ViolationRow({ v }: { v: Violation }) {
  const meta = STATUS_META[v.status];
  return (
    <li className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${meta.row}`}>
      <span className="mt-0.5 shrink-0">{meta.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-ink">{v.title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{v.detail}</p>
        {v.reference && (
          <p className="mt-1 text-[10px] font-mono-scan text-ink-soft/80">Ref: {v.reference}</p>
        )}
      </div>
    </li>
  );
}

function ProductCard({ report }: { report: ScanReport }) {
  const info = report.product?.info;
  const [copied, setCopied] = useState(false);
  const code = report.product?.code ?? report.code ?? "";
  if (!info) {
    return (
      <p className="rounded-xl border border-dashed border-orange-300 bg-orange-50/60 px-4 py-3 text-xs leading-relaxed text-orange-900">
        <strong>GTIN {code || "unknown"} not found in Open Food Facts.</strong>{" "}
        {report.product?.note ?? "No entry for this code yet."} Regional or new products are often
        missing — inspect the label photo for the printed declarations instead.
      </p>
    );
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="rounded-xl border border-line bg-parchment p-4">
      <div className="flex items-start gap-4">
        {info.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.imageUrl} alt={info.name} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg border border-line object-cover" />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-ink-soft">
            <Package className="h-8 w-8" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="good">{code}</Chip>
            {info.codeCountry && <Chip tone="blue">{info.codeCountry}</Chip>}
            {info.novaGroup && <Chip tone="violet">NOVA {info.novaGroup}</Chip>}
            {info.nutriscore && (
              <span
                className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-black uppercase text-white ${
                  { a: "bg-emerald-500", b: "bg-lime-500", c: "bg-amber-400", d: "bg-orange-500", e: "bg-red-500" }[info.nutriscore] ?? "bg-neutral-400"
                }`}
                title={`Nutri-Score ${info.nutriscore}`}
              >
                {info.nutriscore}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-base font-black leading-snug text-ink">{info.name}</h3>
          {info.brands.length > 0 && <p className="mt-0.5 text-xs font-semibold text-ink-soft">{info.brands.join(" · ")}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-[10px] font-bold text-ink-soft hover:border-accent/50">
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy code"}
            </button>
            <a href={`https://world.openfoodfacts.org/product/${code}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-[10px] font-bold text-ink-soft hover:border-accent/50">
              <ExternalLink className="h-3 w-3" /> View on Open Food Facts
            </a>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        {info.quantity && <p className="text-ink-soft"><span className="font-bold text-ink">Quantity:</span> {info.quantity}</p>}
        {info.packaging && <p className="text-ink-soft"><span className="font-bold text-ink">Packaging:</span> {info.packaging}</p>}
        {info.origins && <p className="text-ink-soft"><span className="font-bold text-ink">Origin:</span> {info.origins}</p>}
        {info.manufacturingPlaces && <p className="text-ink-soft"><span className="font-bold text-ink">Made in:</span> {info.manufacturingPlaces}</p>}
        {info.labels.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
            <span className="font-bold text-ink">Certifications:</span>
            {info.labels.map((l) => <Chip key={l}>{l.replace(/-/g, " ")}</Chip>)}
          </p>
        )}
      </div>
      {info.ingredients && (
        <details className="mt-3 rounded-lg border border-line bg-paper/70 px-3 py-2">
          <summary className="cursor-pointer text-xs font-bold text-ink">Ingredients</summary>
          <p className="mt-1.5 max-h-32 overflow-y-auto text-xs leading-relaxed text-ink-soft">{info.ingredients}</p>
        </details>
      )}
      {(info.allergens.length > 0 || info.additives.length > 0) && (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {info.allergens.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="font-bold text-red-700">Allergens</p>
              <p className="mt-0.5 text-red-800/90">{info.allergens.join(", ")}</p>
            </div>
          )}
          {info.additives.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="font-bold text-amber-700">Additives</p>
              <p className="mt-0.5 text-amber-800/90">{info.additives.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultsDisplay({ report }: { report: ScanReport }) {
  const counts = { critical: 0, warn: 0, ok: 0, info: 0 };
  for (const v of report.violations) counts[v.status] += 1;

  return (
    <div className="space-y-4">
      {/* Answers strip */}
      <section className="rounded-2xl border border-line bg-parchment p-3">
        <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-widest text-ink-soft">What the scan says</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <AnswerCard label="Product category" value={categoryOf(report).value} sub={categoryOf(report).sub} />
          <AnswerCard label="Manufactured in" value={locationOf(report).value} sub={locationOf(report).sub} />
          <AnswerCard label="Manufacturing date" value={mfgOf(report).value} sub={mfgOf(report).sub} />
          <AnswerCard label="Best before / expiry" value={expiryOf(report).value} sub={expiryOf(report).sub} />
        </div>
      </section>

      {/* Compliance verdict */}
      <section className="rounded-2xl border border-line bg-parchment p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-ink-soft">
            <ShieldCheck className="h-4 w-4 text-accent" /> Compliance check (rules engine)
          </h2>
          <div className="flex gap-1.5">
            <Chip tone="good">{counts.ok} pass</Chip>
            <Chip tone="warn">{counts.warn} to verify</Chip>
            <Chip tone="neutral">{counts.info} info</Chip>
            <Chip tone={counts.critical ? "warn" : "good"}>{counts.critical} critical</Chip>
          </div>
        </div>
        {report.violations.length === 0 ? (
          <p className="mt-3 text-xs text-ink-soft">
            No compliance rules could be evaluated — inspect a label photo to run the OCR + rules
            pipeline.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {report.violations.map((v) => <ViolationRow key={v.id} v={v} />)}
          </ul>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-ink-soft/80">
          Assessments are evidence-based on what OCR/GS1 could read from your photo — a rule marked
          &quot;to verify&quot; means the field wasn&apos;t visible, not that it&apos;s missing from the label.
          Reference: Legal Metrology (Packaged Commodities) Rules 2011 & FSSAI labelling regulations.
        </p>
      </section>

      {/* Decoded code + GS1 */}
      {report.raw && (
        <section className="rounded-2xl border border-line bg-parchment p-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-ink-soft">Decoded code</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone="good">{report.format}</Chip>
            <code className="break-all font-mono-scan text-sm font-bold text-ink">{report.raw}</code>
          </div>
          {report.gs1 && (
            <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
              {report.gs1.gtin && <p><span className="font-bold text-ink">GTIN:</span> <span className="font-mono-scan text-ink-soft">{report.gs1.gtin}</span></p>}
              {report.gs1.batch && <p><span className="font-bold text-ink">Batch:</span> <span className="text-ink-soft">{report.gs1.batch}</span></p>}
              {report.gs1.serial && <p><span className="font-bold text-ink">Serial:</span> <span className="text-ink-soft">{report.gs1.serial}</span></p>}
              {report.gs1.mfgDateIso && <p><span className="font-bold text-ink">Mfg date (AI 11):</span> {displayDate(report.gs1.mfgDateIso)}</p>}
              {report.gs1.expiryIso && <p><span className="font-bold text-ink">Expiry (AI 17):</span> {displayDate(report.gs1.expiryIso)}</p>}
              {report.gs1.bestBeforeIso && <p><span className="font-bold text-ink">Best before (AI 15):</span> {displayDate(report.gs1.bestBeforeIso)}</p>}
            </div>
          )}
        </section>
      )}

      {/* Product database */}
      {report.product && (
        <section className="rounded-2xl border border-line bg-parchment p-4">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-ink-soft">Product database · Open Food Facts</h2>
          <ProductCard report={report} />
        </section>
      )}

      {/* OCR fields */}
      {report.fields && report.fields.rawText.trim().length > 0 && (
        <section className="rounded-2xl border border-line bg-parchment p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-ink-soft">
            <FileText className="h-3.5 w-3.5" /> Label fields · OCR
          </h2>
          <div className="grid gap-1.5 text-xs sm:grid-cols-2">
            {report.fields.mfgDate && (
              <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-900">
                <span className="font-black">Manufacturing date:</span> <span className="font-bold">{displayDate(report.fields.mfgDate.iso)}</span>
                <span className="text-emerald-700/80">· saw "{report.fields.mfgDate.raw}"</span>
              </p>
            )}
            {report.fields.expiryDate && (
              <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-orange-900">
                <span className="font-black">Expiry:</span> <span className="font-bold">{displayDate(report.fields.expiryDate.iso)}</span>
                <span className="text-orange-700/80">· saw "{report.fields.expiryDate.raw}"</span>
              </p>
            )}
            {report.fields.bestBefore && (
              <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-900">
                <span className="font-black">Best before:</span> <span className="font-bold">{displayDate(report.fields.bestBefore.iso)}</span>
                <span className="text-amber-700/80">· saw "{report.fields.bestBefore.raw}"</span>
              </p>
            )}
            {report.fields.mrp && (
              <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-ink">
                <span className="font-black">MRP:</span> <span className="font-bold">₹{report.fields.mrp.amount}</span>
                <span className="text-ink-soft">· saw "{report.fields.mrp.raw}"</span>
              </p>
            )}
            {report.fields.fssai && (
              <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-ink">
                <span className="font-black">FSSAI licence:</span> <span className="font-mono-scan font-bold">{report.fields.fssai}</span>
              </p>
            )}
            {report.fields.gtinCandidates.length > 0 && (
              <p className="sm:col-span-2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-ink-soft">
                <span className="font-bold text-ink">GTIN printed on label:</span> {report.fields.gtinCandidates.join(", ")}
              </p>
            )}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-bold text-ink-soft hover:text-ink">
              Show raw OCR text ({report.fields.rawText.trim().length} chars)
            </summary>
            <pre className="mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-ink p-3 font-mono-scan text-[11px] leading-relaxed text-neutral-200">
              {report.fields.rawText}
            </pre>
          </details>
        </section>
      )}

      {report.note && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900">
          <Barcode className="mr-1 inline h-3.5 w-3.5" />
          {report.note}
        </p>
      )}
    </div>
  );
}
