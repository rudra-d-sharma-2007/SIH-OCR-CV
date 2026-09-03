# SIH-OCR-CV · LabelScan

Legal-Metrology label-inspection web app (Next.js App Router). Point the
**camera** at a code or photograph a **food label**, and the app answers:

- **Product category & country of origin** — barcode/QR → Open Food Facts
- **Manufacturing date, best-before/expiry** — GS1 QR fields or OCR
- **Label compliance** — MRP, net quantity, dates, FSSAI licence & banned
  substances checked against a rules engine (Legal Metrology rules + FSSAI)

No API keys required.

## How it works

| Step | Where | Implementation |
| --- | --- | --- |
| 1. Capture | browser | `useCamera` hook (rear-camera preferred), photo capture, file upload, drag & drop / paste, built-in EAN-13 + GS1-QR samples |
| 2. Quality gate | browser | `imageValidation.ts` scores blur (Laplacian energy), brightness, contrast before any upload — rejects unreadable photos |
| 3. CV decode | browser | `barcodeDetector.ts` — ZXing over canvas pixels (QR, EAN-13/8, UPC, Code 128/39/93, Data Matrix, ITF…) with contrast/inverted passes |
| 4. Product lookup | `/api/lookup` | Open Food Facts proxy (no key, server-cached) → name, categories, origins, manufacturing places, ingredients |
| 5. Label OCR | `/api/scan` | photo → **server-side Tesseract OCR** → `fieldExtraction.ts` pulls MRP, mfg date, best-before/expiry, FSSAI licence, GTIN digits |
| 6. Rules engine | server & client | `rulesEngine.ts` × `legalMetrologyRules.json` × `bannedSubstances.json` → violations with regulation references |
| 7. Report | UI | `ResultsDisplay.tsx`: answer strip, compliance verdict, decoded code / GS1 fields, product card, OCR fields |

If the server OCR route is unreachable the app **falls back to Tesseract
running in the browser** so scans still complete.

## Layout (blueprint)

```
src/
├─ app/
│  ├─ page.tsx                  landing
│  ├─ scan/page.tsx             the page you visit — wires everything
│  ├─ auth/  dashboard/         demo officer portal
│  └─ api/
│     ├─ lookup/route.ts        barcode → Open Food Facts
│     └─ scan/route.ts          label photo → OCR → fields → violations
├─ components/
│  ├─ BarcodeScanner.tsx        live camera barcode/QR reading
│  ├─ LabelCapture.tsx          fallback photo capture (camera still / upload)
│  ├─ ImageQualityCheck.tsx     blur/dark photo rejection
│  └─ ResultsDisplay.tsx        final report
├─ hooks/useCamera.ts           rear-camera access hook
├─ lib/
│  ├─ barcodeDetector.ts        CV decode logic
│  ├─ imageValidation.ts        blur/brightness scoring math
│  ├─ gs1.ts                    GS1 AI parsing + GTIN checksums
│  ├─ api.ts                    frontend → backend fetches
│  ├─ types.ts                  shared types
│  └─ services/
│     ├─ openFoodFacts.ts       Open Food Facts URL/mapping helpers
│     ├─ ocrService.ts          Tesseract worker (browser)
│     ├─ fieldExtraction.ts     MRP/FSSAI/dates out of raw OCR text
│     └─ rulesEngine.ts         checks fields vs regulation data
└─ data/
   ├─ legalMetrologyRules.json  LM (Packaged Commodities) Rules 2011 + FSSAI refs
   └─ bannedSubstances.json     banned/restricted substance reference list
```

## Run it

```bash
bun install
bun run dev        # http://localhost:3000
```

```bash
bun run typecheck           # tsc --noEmit
bun run build               # production build
bun scripts/sanity.test.ts  # parser / checksum / rules regression tests
```

## Notes & honesty

- Plain EAN/UPC barcodes encode only a product number. Where data is missing
  the UI says so and falls back to OCR / GS1-prefix inference — it never
  invents values.
- Rules verdicts are evidence-based on what OCR/GS1 could read: a rule marked
  "to verify" means the field wasn't visible in the photo, not that the label
  is non-compliant.
- `/api/scan` downloads the Tesseract `eng` model from the CDN on its first
  call; later calls are fast. Camera access needs HTTPS/localhost.
- Regulation data is a starting reference list — extend
  `src/data/legalMetrologyRules.json` and `bannedSubstances.json` as needed.

## Next steps (SIH build-out)

- Persist scans + violations to the officer backend (LabelLens `backend`
  branch API) for batch export.
- Reconcile declared MRP/dates against GS1 payloads and flag mismatches.
- Optional LLM structured extraction of the nutrition panel (key needed).
