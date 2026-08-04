import type { HotLeadSource } from './types'

export interface ParsedHotLead {
  name: string
  phone: string | null
  source: HotLeadSource
  recommendedBy: string | null
  notes: string | null
}

export interface ParseHotListResult {
  leads: ParsedHotLead[]
  skipped: number
}

function normalizeHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const HEADER_ALIASES = {
  name: ['nome'],
  phone: ['telefone', 'celular', 'contato', 'whatsapp'],
  source: ['fonte', 'origem'],
  recommendedBy: ['recomendado por', 'quem recomendou', 'indicado por', 'indicacao de'],
  notes: ['caracteristicas', 'outras caracteristicas', 'observacoes', 'obs'],
}

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((h) => aliases.some((a) => h.includes(a)))
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toLocaleDateString('pt-BR')
  return String(v).trim()
}

function rowsToLeads(rows: unknown[][]): ParseHotListResult {
  if (rows.length === 0) return { leads: [], skipped: 0 }
  const header = rows[0].map((c) => normalizeHeader(cellText(c)))
  const nameIdx = findColumn(header, HEADER_ALIASES.name)
  const phoneIdx = findColumn(header, HEADER_ALIASES.phone)
  const sourceIdx = findColumn(header, HEADER_ALIASES.source)
  const recIdx = findColumn(header, HEADER_ALIASES.recommendedBy)
  const notesIdx = findColumn(header, HEADER_ALIASES.notes)

  const leads: ParsedHotLead[] = []
  let skipped = 0
  for (const row of rows.slice(1)) {
    const name = nameIdx >= 0 ? cellText(row[nameIdx]) : ''
    if (!name) {
      if (row.some((c) => cellText(c))) skipped++
      continue
    }
    const sourceRaw = sourceIdx >= 0 ? normalizeHeader(cellText(row[sourceIdx])) : ''
    const source: HotLeadSource = sourceRaw.includes('recom') ? 'recomendacao' : 'mercado'
    leads.push({
      name,
      phone: phoneIdx >= 0 ? cellText(row[phoneIdx]) || null : null,
      source,
      recommendedBy: source === 'recomendacao' && recIdx >= 0 ? cellText(row[recIdx]) || null : null,
      notes: notesIdx >= 0 ? cellText(row[notesIdx]) || null : null,
    })
  }
  return { leads, skipped }
}

function parseCsv(text: string): string[][] {
  // Handles quoted fields with embedded ';' or ',' — MetLife/Excel exports
  // from pt-BR locales commonly use ';' as the delimiter.
  const delimiter = text.split('\n')[0].includes(';') ? ';' : ','
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          cur += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        cells.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur)
    rows.push(cells)
  }
  return rows
}

/** Reads a consultor's uploaded lista HOT — .xlsx (via read-excel-file, a
 * read-only parser with no transitive deps, lazy-loaded so it never bloats
 * the main bundle) or .csv — and maps its columns to our fields by header
 * text, tolerant of accents/case/wording so a líder's own template works. */
export async function parseHotListFile(file: File): Promise<ParseHotListResult> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = await file.text()
    return rowsToLeads(parseCsv(text))
  }
  const { readSheet } = await import('read-excel-file/browser')
  const rows = await readSheet(file)
  return rowsToLeads(rows)
}
