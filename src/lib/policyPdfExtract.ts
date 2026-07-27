import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { METLIFE_PRODUCT_LABELS } from './metlifeContract'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/** Runs entirely in the browser — the PDF never leaves the device just to read its text. */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
  }
  return text
}

/** Picks the longest matching product label — "Vida Total Singular Legado"
 * over "Vida Total Singular" when both appear, since the shorter one is
 * always a substring of the longer. */
export function guessProduct(text: string): string | null {
  const lower = text.toLowerCase()
  const matches = METLIFE_PRODUCT_LABELS.filter((label) => lower.includes(label.toLowerCase()))
  if (matches.length === 0) return null
  return matches.reduce((longest, m) => (m.length > longest.length ? m : longest))
}

/** MetLife's own apólice PDFs print a "<total> <IOF> <líquido> Total (R$)"
 * row (columns land out of visual order once the PDF's text layer is read
 * linearly) — the first number is the gross monthly premium the client pays. */
export function guessPremium(text: string): number | null {
  const m = text.match(/([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*Total\s*\(R\$\)/i)
  if (!m) return null
  const value = Number(m[1].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(value) ? value : null
}
