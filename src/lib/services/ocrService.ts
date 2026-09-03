/**
 * Runs Tesseract OCR (client-side). The worker + WASM + `eng` traineddata are
 * fetched from the jsDelivr CDN on first use — no API key, no bundler config.
 */

interface OcrWorker {
  recognize(
    image: unknown,
    options?: Record<string, boolean>
  ): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

let workerPromise: Promise<OcrWorker> | null = null;
let progressListener: ((status: string, progress: number) => void) | null = null;

export function setOcrProgressListener(
  fn: ((status: string, progress: number) => void) | null
) {
  progressListener = fn;
}

function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          progressListener?.(m.status, m.progress);
        },
        errorHandler: () => {
          /* failures surface through recognize() */
        },
      })
    );
  }
  return workerPromise;
}

export async function disposeOcrWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise.catch(() => null);
    if (worker) await worker.terminate().catch(() => undefined);
    workerPromise = null;
  }
}

export async function recognizeText(input: HTMLCanvasElement | Blob): Promise<string> {
  const worker = await getWorker();
  const result = await worker.recognize(input, {
    text: true,
    blocks: false,
    layoutBlocks: false,
    hocr: false,
    tsv: false,
    box: false,
    unlv: false,
    sd: false,
    pdf: false,
  });
  return result.data.text ?? "";
}
