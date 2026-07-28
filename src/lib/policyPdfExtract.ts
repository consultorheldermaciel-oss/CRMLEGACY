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
 * always a substring of the longer. Works when the apólice spells out the
 * full product name somewhere (common for Legado/Singular variants). */
function guessProductByLiteralMatch(text: string): string | null {
  const lower = text.toLowerCase()
  const matches = METLIFE_PRODUCT_LABELS.filter((label) => lower.includes(label.toLowerCase()))
  if (matches.length === 0) return null
  return matches.reduce((longest, m) => (m.length > longest.length ? m : longest))
}

const VIDA_TOTAL_YEARS = [5, 10, 20, 65, 99]
const VIDA_SEGURA_YEARS = [5, 10, 15, 20, 25, 75]

function closestYear(candidates: number[], target: number): number {
  return candidates.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
}

/** Most renewal apólices don't spell out the full product name — just
 * "VIDA TOTAL" or a bare "VIDA SEGURA" header, no number. The number comes
 * from the "Prêmio(s) por cobertura(s)" table's "Prazo de pagamento do
 * Prêmio" for the base "Morte" coverage specifically — NOT the coverage's
 * own duration (whole-life plans show "Vitalício" there) and NOT the mode
 * across every rider (Doenças Graves/DIH/Fratura often share a shorter,
 * unrelated term). Whole-life ("vitalício" appears somewhere in the
 * document) → Vida Total; otherwise → Vida Segura. */
function guessProductByRule(text: string): string | null {
  const isVitalicio = /vital[ií]cio/i.test(text)
  const morteMatch = text.match(/\bMorte\b[^\n]{0,40}?(\d{1,3})\s*Anos?\b/i)
  if (!morteMatch) return null
  const years = Number(morteMatch[1])
  if (!Number.isFinite(years) || years <= 0) return null
  const table = isVitalicio ? VIDA_TOTAL_YEARS : VIDA_SEGURA_YEARS
  const family = isVitalicio ? 'Vida Total' : 'Vida Segura'
  return `${family} ${closestYear(table, years)}`
}

export function guessProduct(text: string): string | null {
  return guessProductByLiteralMatch(text) ?? guessProductByRule(text)
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

interface PositionedItem {
  str: string
  x: number
}

/** MetLife's header block ("Nº da apólice", "Data de início de vigência" etc.)
 * prints each label and its value side by side, but the two rows of the
 * underlying table (all values, then all labels) get flattened into
 * unrelated order by plain linear text extraction — that's why guessProduct
 * /guessPremium work on scrambled text but a label like "Data de início de
 * vigência:" can't just be regex-matched against its value. Instead this
 * reads pdfjs's item coordinates directly: items sharing the same visual row
 * (rounded y), sorted left to right, put every label immediately before its
 * value — same trick, no matter which of the header's two label columns
 * (x≈30 or x≈294) it's in. */
async function extractPdfRows(file: File): Promise<PositionedItem[][]> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const rows: PositionedItem[][] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const byRow = new Map<number, PositionedItem[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5])
      const rowKey = [...byRow.keys()].find((k) => Math.abs(k - y) <= 2) ?? y
      if (!byRow.has(rowKey)) byRow.set(rowKey, [])
      byRow.get(rowKey)!.push({ str: item.str.trim(), x: item.transform[4] })
    }
    for (const items of byRow.values()) {
      rows.push(items.sort((a, b) => a.x - b.x))
    }
  }
  return rows
}

function findValueAfterLabel(rows: PositionedItem[][], labelText: string): string | null {
  const labelLower = labelText.toLowerCase()
  for (const row of rows) {
    const idx = row.findIndex((it) => it.str.toLowerCase().includes(labelLower))
    if (idx !== -1 && row[idx + 1]) return row[idx + 1].str
  }
  return null
}

/** Returns the apólice's "Data de início de vigência" as dd/mm/yyyy, or null. */
export async function guessVigenciaInicio(file: File): Promise<string | null> {
  const rows = await extractPdfRows(file)
  const value = findValueAfterLabel(rows, 'Data de início de vigência')
  return value && /^\d{2}\/\d{2}\/\d{4}$/.test(value) ? value : null
}
