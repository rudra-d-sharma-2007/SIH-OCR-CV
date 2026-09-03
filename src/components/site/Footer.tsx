import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink py-8 text-neutral-400">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 text-xs sm:flex-row sm:items-center">
        <p className="font-mono-scan">
          LabelScan<span className="text-accent">.CV</span> · OCR/CV label
          inspection demo
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span>CV decode · ZXing</span>
          <span>OCR · Tesseract.js</span>
          <span>
            Product data ·{" "}
            <a
              className="underline decoration-neutral-600 underline-offset-2 hover:text-white"
              href="https://world.openfoodfacts.org/"
              target="_blank"
              rel="noreferrer"
            >
              Open Food Facts
            </a>
          </span>
          <Link href="/scan" className="hover:text-white">
            Start scanning
          </Link>
        </div>
      </div>
    </footer>
  );
}
