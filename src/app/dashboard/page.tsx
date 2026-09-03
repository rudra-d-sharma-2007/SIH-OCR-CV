"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  History,
  ScanLine,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { loadHistory, clearHistory } from "@/lib/history";
import type { HistoryEntry } from "@/lib/types";
import { displayDate } from "@/lib/services/fieldExtraction";

export default function DashboardPage() {
  const { officer } = useAuth();
  const [items, setItems] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setItems(loadHistory());
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-orange-600">
            <ShieldCheck className="h-4 w-4" />
            {officer ? `${officer.badge} · ${officer.label}` : "Demo workspace"}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            Label inspection desk
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Scans recorded on this device appear here.
          </p>
        </div>
        <Link
          href="/scan"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-white shadow-md shadow-orange-200 transition-all hover:-translate-y-0.5 hover:bg-orange-500"
        >
          <ScanLine className="h-4 w-4" />
          New label scan
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-parchment p-5">
          <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-ink-soft">
            <ClipboardList className="h-4 w-4 text-accent" />
            Field workflow
          </h2>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              "Scan the retail package barcode or GS1 QR.",
              "Check category & declared origin against the product.",
              "OCR reads mfg date / best-before / MRP off the printed block.",
              "Reconcile the declaration with the physical label.",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-black text-accent">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>
          {!officer && (
            <p className="mt-5 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-soft">
              Sign in as an officer to personalise this desk —{" "}
              <Link href="/auth" className="font-bold text-accent underline underline-offset-2">
                officer sign-in
              </Link>
              .
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-parchment p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-ink-soft">
              <History className="h-4 w-4 text-accent" />
              Recent scans (this device)
            </h2>
            {items.length > 0 && (
              <button
                onClick={() => {
                  clearHistory();
                  setItems([]);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft hover:text-orange-600"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-line bg-paper/60 p-6 text-center">
              <p className="text-sm font-semibold text-ink-soft">
                No scans yet on this device.
              </p>
              <p className="mt-1 text-xs text-ink-soft/80">
                Complete a scan on the{" "}
                <Link href="/scan" className="font-bold text-accent underline underline-offset-2">
                  scanner page
                </Link>{" "}
                and it will show up here.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {items.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">
                      {h.name ?? (h.code ? `GTIN ${h.code}` : "Label scan")}
                      {h.category ? <span className="text-ink-soft"> · {h.category}</span> : null}
                    </p>
                    <p className="mt-0.5 font-mono-scan text-[10px] text-ink-soft">
                      {new Date(h.at).toLocaleString()} · {h.format ?? "image"}
                      {h.mfgDate ? ` · mfg ${displayDate(h.mfgDate)}` : ""}
                    </p>
                  </div>
                  <Link
                    href="/scan"
                    className="shrink-0 rounded-md border border-line px-2 py-1 text-[10px] font-bold text-ink-soft transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    Scan again
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-8 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900">
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Next step for the SIH build-out: persist scans to the officer backend
        (batch export) and reconcile declared dates & MRP against the GS1 payload.
      </p>
    </div>
  );
}
