import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CalendarDays,
  Database,
  FileText,
  MapPin,
  QrCode,
  ScanLine,
  Tags,
  UploadCloud,
  Radar,
} from "lucide-react";

function BarcodeGraphic() {
  // decorative faux label-read card
  return (
    <div className="relative mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur">
      <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-lg">
        <ScanLine className="h-4 w-4" />
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        <span>Scan result</span>
        <span className="text-accent">LabelScan.CV</span>
      </div>

      <div className="mt-3 rounded-xl bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-orange-100 text-xl font-black text-accent">
            B
          </div>
          <div>
            <p className="text-xs font-black text-neutral-900">
              Biscuits &amp; cookies
            </p>
            <p className="text-[10px] text-neutral-500">
              Manufactured in India · GTIN 8901…
            </p>
          </div>
        </div>
        <div className="mt-3 flex h-8 items-end gap-[2px]" aria-hidden>
          {Array.from({ length: 42 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] bg-neutral-900"
              style={{ height: `${22 + ((i * 37) % 14)}px` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono-scan text-[9px] text-neutral-400">
          <span>8 9 0 1 0 3 0 1 2 3 4 5 1</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[9px]">
          <span className="rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-700">
            Category · Food
          </span>
          <span className="rounded bg-sky-50 px-2 py-1 font-bold text-sky-700">
            GS1 prefix 890 · India
          </span>
          <span className="rounded bg-amber-50 px-2 py-1 font-bold text-amber-700">
            Mfg: printed on label
          </span>
          <span className="rounded bg-orange-50 px-2 py-1 font-bold text-orange-700">
            OCR · date marks
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-semibold text-neutral-400">
        <span className="flex items-center gap-1">
          <QrCode className="h-3 w-3" /> QR
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Camera className="h-3 w-3" /> live feed
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Database className="h-3 w-3" /> Open Food Facts
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: <Camera className="h-5 w-5" />,
    title: "Live camera scanning",
    body: "Point the phone/laptop camera at the label — QR codes and 1D barcodes auto-detect from the video feed, no shutter press needed.",
  },
  {
    icon: <UploadCloud className="h-5 w-5" />,
    title: "Upload or paste a photo",
    body: "Drop in a picture of the label, pick one from disk, or paste from the clipboard. CV preprocessing handles rotation and glossy lighting.",
  },
  {
    icon: <QrCode className="h-5 w-5" />,
    title: "GS1 QR decode",
    body: "GS1 QRs on FSSAI-era packaging carry machine-readable batch, manufacturing date (AI 11), best-before (AI 15) and expiry (AI 17) fields.",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Label-text OCR",
    body: "Printed declarations are read in the browser with Tesseract.js — manufacturing date, best-before, MRP and FSSAI licence numbers get extracted.",
  },
  {
    icon: <Database className="h-5 w-5" />,
    title: "Product database backend",
    body: "The scanned GTIN goes to our /api/lookup route, which proxies the public Open Food Facts database (no API key) with server-side caching.",
  },
  {
    icon: <Radar className="h-5 w-5" />,
    title: "Transparent pipeline",
    body: "Every scan logs a data-source trace — which decoder, which GS1 fields, which database answered, what OCR saw. No black boxes.",
  },
];

const STEPS = [
  {
    icon: <ScanLine className="h-6 w-6" />,
    title: "1 · Capture",
    body: "Live camera feed or an uploaded/pasted label photo.",
  },
  {
    icon: <QrCode className="h-6 w-6" />,
    title: "2 · Decode (CV)",
    body: "ZXing decodes QR / EAN-13 / UPC / Code-128 from raw pixels; GS1 payloads are unpacked for dates & batch.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "3 · Read (OCR)",
    body: "Tesseract.js reads the printed text for mfg date, best-before, MRP, FSSAI.",
  },
  {
    icon: <Database className="h-6 w-6" />,
    title: "4 · Enrich (backend)",
    body: "GTIN → /api/lookup → Open Food Facts: name, category, origins, ingredients.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-orange-300">
              <ScanLine className="h-3.5 w-3.5" />
              OCR + CV food-label reader
            </p>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Scan the label.
              <br />
              <span className="text-accent">Know the product.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-300">
              Point a camera at any packaged-food label — or upload a photo —
              and get the food category, country of manufacture, manufacturing
              date and best-before / expiry, decoded from the QR/barcode and
              OCR&apos;d off the printed text.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-900/40 transition-all hover:-translate-y-0.5 hover:bg-orange-500"
              >
                Start scanning
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-neutral-200 transition-colors hover:border-white/40 hover:bg-white/5"
              >
                Try the GS1 sample
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Tags className="h-3.5 w-3.5 text-accent" /> Food category
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-accent" /> Manufactured in
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-accent" /> Mfg / expiry dates
              </span>
            </div>
          </div>
          <BarcodeGraphic />
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-t border-line bg-paper py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-center text-2xl font-black tracking-tight text-ink">
            How a scan works
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-ink-soft">
            Four cooperating stages — two run entirely in your browser, one
            talks to our backend, and the printed text closes the gap that
            barcodes can&apos;t cover.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-line bg-parchment p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-accent">
                  {s.icon}
                </div>
                <h3 className="mt-3 text-sm font-black text-ink">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <strong>An honest note:</strong> a plain EAN/UPC barcode encodes only
            a product number — no dates, no origin. That&apos;s why the tool also
            reads GS1 QR payloads (dates + batch) and OCRs the printed label,
            and falls back to the GS1 country prefix for geography.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-line bg-parchment py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-center text-2xl font-black tracking-tight text-ink">
            Built for label inspection
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-line bg-paper p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-accent">
                  {f.icon}
                </div>
                <h3 className="mt-3 text-sm font-black text-ink">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line bg-ink py-14 text-white">
        <div className="mx-auto w-full max-w-6xl px-4 text-center">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            Point, scan, done.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-300">
            Live camera, photo upload and built-in GS1/EAN samples — everything
            runs, no API keys needed.
          </p>
          <Link
            href="/scan"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-black text-white shadow-lg shadow-orange-900/40 transition-all hover:-translate-y-0.5 hover:bg-orange-500"
          >
            Open the scanner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
