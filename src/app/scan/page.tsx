"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Barcode, FileScan, History, ScanSearch } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { LabelCapture } from "@/components/LabelCapture";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import {
  canvasToBlob,
  decodeCanvas,
  makeEanSampleCanvas,
  makeGs1QrSampleCanvas,
} from "@/lib/barcodeDetector";
import { parseGs1, gtinCandidatesFromText } from "@/lib/gs1";
import { lookupProduct, inspectLabelImage } from "@/lib/api";
import { parseLabelText } from "@/lib/services/fieldExtraction";
import { inspectLabel } from "@/lib/services/rulesEngine";
import { recognizeText, setOcrProgressListener } from "@/lib/services/ocrService";
import { recordScan } from "@/lib/history";
import type { DecodeHit, HistoryEntry, ScanReport } from "@/lib/types";

type Mode = "barcode" | "label";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("barcode");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setOcrProgressListener((status, progress) => {
      setOcrStatus(`${status} · ${Math.round(progress * 100)}%`);
    });
    return () => setOcrProgressListener(null);
  }, []);

  const pushReport = useCallback((report: ScanReport) => {
    setReports((prev) => [report, ...prev].slice(0, 8));
    setActive(0);
  }, []);

  const remember = useCallback((report: ScanReport) => {
    const entry: HistoryEntry = {
      id: report.id,
      at: report.at,
      code: report.code,
      format: report.format,
      name: report.product?.found ? report.product.info?.name : undefined,
      category: report.product?.found ? report.product.info?.categories[0] : undefined,
      mfgDate: report.gs1?.mfgDateIso ?? report.fields?.mfgDate?.iso,
    };
    recordScan(entry);
  }, []);

  // ---- barcode flow --------------------------------------------------------

  const handleBarcode = useCallback(
    async (hit: DecodeHit) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setPhase("Parsing the code…");
      try {
        const gs1 = parseGs1(hit.text);
        const candidates: string[] = [];
        for (const c of gtinCandidatesFromText(hit.text)) if (!candidates.includes(c)) candidates.push(c);
        if (gs1?.gtin && !candidates.includes(gs1.gtin)) candidates.unshift(gs1.gtin);

        let product = null;
        if (candidates.length) {
          setPhase(`Looking up ${candidates[0]} in the product database…`);
          for (const code of candidates.slice(0, 3)) {
            const result = await lookupProduct(code);
            if (result.found) {
              product = result;
              lastCodeRef.current = code;
              break;
            }
            product = result; // keep last (not-found) result for the note
          }
        }

        const report: ScanReport = {
          id: newId(),
          kind: "barcode",
          at: Date.now(),
          code: product?.code ?? gs1?.gtin ?? candidates[0],
          format: hit.format,
          raw: hit.text,
          gs1,
          product,
          fields: null,
          violations: [],
          note: !candidates.length
            ? /^https?:\/\//i.test(hit.text)
              ? "That QR contains a URL — scan the label photo tab to read printed declarations."
              : "That code isn't a product number — use the label photo tab for OCR + rules."
            : undefined,
        };
        pushReport(report);
        remember(report);
      } finally {
        busyRef.current = false;
        setBusy(false);
        setPhase("");
      }
    },
    [pushReport, remember]
  );

  // ---- label (OCR + rules) flow --------------------------------------------

  const runClientOcrFallback = useCallback(
    async (canvas: HTMLCanvasElement, code?: string): Promise<ScanReport> => {
      setPhase("Server OCR unavailable — running Tesseract OCR in your browser…");
      const text = await recognizeText(canvas);
      setOcrStatus(null);
      const fields = parseLabelText(text);
      let product = null;
      const codes = fields.gtinCandidates;
      if (codes.length && !code) {
        const result = await lookupProduct(codes[0]);
        if (result.found) product = result;
      }
      const violations = inspectLabel({ text, fields, product: product?.info ?? null });
      return {
        id: newId(),
        kind: "label",
        at: Date.now(),
        code: code ?? product?.code ?? fields.gtinCandidates[0],
        fields,
        product,
        violations,
        note: "Server-side OCR was unavailable, so Tesseract ran in the browser. Results should be identical.",
      };
    },
    []
  );

  const handleLabelPhoto = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setPhase("Uploading the label photo for server-side OCR…");
      try {
        const blob = await canvasToBlob(canvas, 0.92);
        if (!blob) throw new Error("Could not encode the photo.");
        const code = lastCodeRef.current;
        let report: ScanReport;
        try {
          setPhase("Server OCR + field extraction + rules engine…");
          const res = await inspectLabelImage(blob, code);
          report = {
            id: newId(),
            kind: "label",
            at: Date.now(),
            code: res.product?.code ?? code ?? res.fields?.gtinCandidates[0],
            fields: res.fields,
            product: res.product ?? null,
            violations: res.violations,
            note: res.note,
          };
        } catch {
          report = await runClientOcrFallback(canvas, code);
        }
        pushReport(report);
        remember(report);
      } finally {
        busyRef.current = false;
        setBusy(false);
        setPhase("");
      }
    },
    [pushReport, remember, runClientOcrFallback]
  );

  // ---- samples for quick demo ----------------------------------------------

  const runSample = useCallback(
    async (kind: "ean" | "qr") => {
      if (busyRef.current) return;
      const canvas = kind === "ean" ? makeEanSampleCanvas() : makeGs1QrSampleCanvas();
      const hit = decodeCanvas(canvas);
      // handleBarcode / handleLabelPhoto own their own busy-guard + phase.
      if (hit) await handleBarcode(hit);
      else await handleLabelPhoto(canvas);
    },
    [handleBarcode, handleLabelPhoto]
  );

  const activeReport = active !== null ? reports[active] : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
      <div className="mb-6 text-center">
        <p className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-700">
          <ScanSearch className="h-3.5 w-3.5" /> CV decode · Tesseract OCR · rules engine
        </p>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
          Label inspection desk
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Scan the barcode/QR for product identity, then photograph the label —
          OCR reads the printed declarations and the rules engine checks them
          against Legal Metrology + FSSAI requirements.
        </p>
      </div>

      {/* mode tabs */}
      <div className="mx-auto mb-6 grid w-full max-w-2xl grid-cols-2 gap-1 rounded-xl border border-line bg-paper p-1">
        {(
          [
            ["barcode", "Barcode / QR", Barcode],
            ["label", "Label photo · OCR + rules", FileScan],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${
              mode === key ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:bg-paper"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-2xl border border-line bg-parchment p-4 shadow-sm">
            {mode === "barcode" ? (
              <BarcodeScanner busy={busy} onDetected={(hit) => void handleBarcode(hit)} />
            ) : (
              <LabelCapture busy={busy} phase={phase} onSubmit={(canvas) => void handleLabelPhoto(canvas)} />
            )}

            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                No label handy? Try a sample
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => void runSample("ean")}
                  disabled={busy}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-xs font-bold text-ink transition-colors hover:border-accent/50 disabled:opacity-50"
                >
                  Sample EAN-13 barcode
                  <span className="mt-0.5 block text-[10px] font-medium text-ink-soft">→ product lookup</span>
                </button>
                <button
                  onClick={() => void runSample("qr")}
                  disabled={busy}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-xs font-bold text-ink transition-colors hover:border-accent/50 disabled:opacity-50"
                >
                  Sample GS1 QR
                  <span className="mt-0.5 block text-[10px] font-medium text-ink-soft">→ dates, batch &amp; lookup</span>
                </button>
              </div>
            </div>

            {/* status strip */}
            <div className="mt-3 min-h-9 rounded-lg border border-line bg-paper/70 px-3 py-2 text-xs">
              {busy ? (
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  {phase}
                  {ocrStatus && (
                    <span className="font-mono-scan text-[10px] text-ink-soft">({ocrStatus})</span>
                  )}
                </span>
              ) : activeReport ? (
                <span className="font-semibold text-emerald-700">
                  {activeReport.kind === "barcode" ? "Code decoded" : "Label inspected"} —{" "}
                  {activeReport.violations.length > 0
                    ? `${activeReport.violations.filter((v) => v.status === "critical").length} critical · ${activeReport.violations.filter((v) => v.status === "warn").length} to verify`
                    : "no violations evaluated for this scan"}
                </span>
              ) : (
                <span className="text-ink-soft">
                  Point the camera at a code, or switch to the label tab to run OCR + rules.
                </span>
              )}
            </div>
          </div>

          {/* this-session history */}
          {reports.length > 1 && (
            <div className="rounded-2xl border border-line bg-parchment p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-ink-soft">
                <History className="h-3.5 w-3.5" /> This session
              </p>
              <div className="flex flex-wrap gap-1.5">
                {reports.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => setActive(i)}
                    className={`rounded-md border px-2 py-1 font-mono-scan text-[10px] font-bold transition-colors ${
                      i === active
                        ? "border-accent bg-orange-50 text-accent"
                        : "border-line bg-paper text-ink-soft hover:border-accent/40"
                    }`}
                  >
                    {r.format ?? r.kind} · {r.code ?? r.fields?.gtinCandidates[0] ?? "label"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          {activeReport ? (
            <ResultsDisplay report={activeReport} />
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-parchment p-8 text-center">
              <ScanSearch className="mx-auto h-10 w-10 text-accent/70" />
              <h2 className="mt-3 text-lg font-black text-ink">Results will appear here</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                Barcode mode answers <em>what</em> the product is (category, origin via Open Food
                Facts). Label mode answers <em>whether the label complies</em> — MRP, dates, FSSAI
                and banned substances, checked against the rules engine.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
