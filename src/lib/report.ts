import type { Appointment, Profile } from './types'
import { dstr, fmtBRL } from './format'

export function mondayOf(d: Date): Date {
  const dt = new Date(d)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return dt
}

export function weekRange(anchor: Date): { start: string; end: string; startDate: Date; endDate: Date } {
  const monday = mondayOf(anchor)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: dstr(monday.getFullYear(), monday.getMonth(), monday.getDate()),
    end: dstr(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()),
    startDate: monday,
    endDate: sunday,
  }
}

export interface WeeklyReportRow {
  consultantId: string
  consultantName: string
  abordagens: number
  fechamentos: number
  recomendacoesAbordagem: number
  recomendacoesFechamento: number
  apolicesFechadas: number
  valorApolices: number
  capitalSegurado: number
  capitalSeguradoAh: number
}

export interface WeeklyReportTotals {
  abordagens: number
  fechamentos: number
  recomendacoesAbordagem: number
  recomendacoesFechamento: number
  apolicesFechadas: number
  valorApolices: number
  capitalSegurado: number
  capitalSeguradoAh: number
  premioMedio: number
}

/** Per-head average — team totals divided by number of consultants, not by
 * policies closed (that's premioMedio). Shows production per consultor
 * regardless of how unevenly it's distributed across the team. */
export interface WeeklyReportAverages {
  abordagens: number
  fechamentos: number
  recomendacoesAbordagem: number
  recomendacoesFechamento: number
  apolicesFechadas: number
  valorApolices: number
  capitalSegurado: number
  capitalSeguradoAh: number
}

export function buildWeeklyReport(
  appointments: Appointment[],
  team: Profile[],
  weekStart: string,
  weekEnd: string,
): { rows: WeeklyReportRow[]; totals: WeeklyReportTotals; averages: WeeklyReportAverages } {
  const rows: WeeklyReportRow[] = team.map((c) => {
    const apps = appointments.filter((a) => a.consultant_id === c.id && a.date >= weekStart && a.date <= weekEnd)
    const closed = apps.filter((a) => a.policy_closed)
    return {
      consultantId: c.id,
      consultantName: c.name,
      abordagens: apps.filter((a) => a.type === 'abordagem').length,
      fechamentos: apps.filter((a) => a.type === 'fechamento').length,
      recomendacoesAbordagem: apps.filter((a) => a.type === 'abordagem').reduce((s, a) => s + (a.recommendations || 0), 0),
      recomendacoesFechamento: apps.filter((a) => a.type === 'fechamento').reduce((s, a) => s + (a.recommendations || 0), 0),
      apolicesFechadas: closed.length,
      valorApolices: closed.reduce((s, a) => s + (a.premium || 0), 0),
      capitalSegurado: closed.reduce((s, a) => s + (a.capital_segurado || 0), 0),
      capitalSeguradoAh: closed.reduce((s, a) => s + (a.capital_segurado_ah || 0), 0),
    }
  })

  const totals = rows.reduce(
    (acc, r) => ({
      abordagens: acc.abordagens + r.abordagens,
      fechamentos: acc.fechamentos + r.fechamentos,
      recomendacoesAbordagem: acc.recomendacoesAbordagem + r.recomendacoesAbordagem,
      recomendacoesFechamento: acc.recomendacoesFechamento + r.recomendacoesFechamento,
      apolicesFechadas: acc.apolicesFechadas + r.apolicesFechadas,
      valorApolices: acc.valorApolices + r.valorApolices,
      capitalSegurado: acc.capitalSegurado + r.capitalSegurado,
      capitalSeguradoAh: acc.capitalSeguradoAh + r.capitalSeguradoAh,
    }),
    {
      abordagens: 0,
      fechamentos: 0,
      recomendacoesAbordagem: 0,
      recomendacoesFechamento: 0,
      apolicesFechadas: 0,
      valorApolices: 0,
      capitalSegurado: 0,
      capitalSeguradoAh: 0,
    },
  )

  const headcount = team.length
  const averages: WeeklyReportAverages = {
    abordagens: headcount ? totals.abordagens / headcount : 0,
    fechamentos: headcount ? totals.fechamentos / headcount : 0,
    recomendacoesAbordagem: headcount ? totals.recomendacoesAbordagem / headcount : 0,
    recomendacoesFechamento: headcount ? totals.recomendacoesFechamento / headcount : 0,
    apolicesFechadas: headcount ? totals.apolicesFechadas / headcount : 0,
    valorApolices: headcount ? totals.valorApolices / headcount : 0,
    capitalSegurado: headcount ? totals.capitalSegurado / headcount : 0,
    capitalSeguradoAh: headcount ? totals.capitalSeguradoAh / headcount : 0,
  }

  return {
    rows,
    totals: {
      ...totals,
      premioMedio: totals.apolicesFechadas ? Math.round(totals.valorApolices / totals.apolicesFechadas) : 0,
    },
    averages,
  }
}

const CSV_HEADERS = [
  'Consultor',
  'Abordagens',
  'Fechamentos',
  'Recomendações (abordagem)',
  'Recomendações (fechamento)',
  'Apólices fechadas',
  'Valor das apólices (R$)',
  'Capital segurado — morte (R$)',
  'Capital segurado — AH (R$)',
]

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A .csv opens directly in Excel with no extra library, so this covers "quero
 * em Excel também" without adding a client-side spreadsheet-writing
 * dependency (the maintained ones either have unpatched CVEs or add real
 * bundle weight for what's ultimately a flat table). CSV is plain text, so
 * it can't carry the Legacy logo image — only the PDF export can. */
export function weeklyReportCsv(
  rows: WeeklyReportRow[],
  totals: WeeklyReportTotals,
  averages: WeeklyReportAverages,
  weekStart: string,
  weekEnd: string,
): string {
  const round1 = (n: number) => Math.round(n * 10) / 10
  const lines = [
    'Legacy — Gestão e Desenvolvimento',
    `Relatório de produtividade — semana de ${weekStart} a ${weekEnd}`,
    '',
    CSV_HEADERS.map(csvCell).join(';'),
    ...rows.map((r) =>
      [
        r.consultantName,
        r.abordagens,
        r.fechamentos,
        r.recomendacoesAbordagem,
        r.recomendacoesFechamento,
        r.apolicesFechadas,
        r.valorApolices,
        r.capitalSegurado,
        r.capitalSeguradoAh,
      ]
        .map(csvCell)
        .join(';'),
    ),
    [
      'EQUIPE (total)',
      totals.abordagens,
      totals.fechamentos,
      totals.recomendacoesAbordagem,
      totals.recomendacoesFechamento,
      totals.apolicesFechadas,
      totals.valorApolices,
      totals.capitalSegurado,
      totals.capitalSeguradoAh,
    ]
      .map(csvCell)
      .join(';'),
    [
      'Média por consultor',
      round1(averages.abordagens),
      round1(averages.fechamentos),
      round1(averages.recomendacoesAbordagem),
      round1(averages.recomendacoesFechamento),
      round1(averages.apolicesFechadas),
      Math.round(averages.valorApolices),
      Math.round(averages.capitalSegurado),
      Math.round(averages.capitalSeguradoAh),
    ]
      .map(csvCell)
      .join(';'),
    '',
    `Prêmio médio da equipe (R$);${csvCell(totals.premioMedio)}`,
  ]
  return lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // Excel needs a UTF-8 BOM to render accented characters correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** What the consultor typed into "Meu relatório semanal" (self-report). */
export interface SelfReportInput {
  apolicesCount: number
  premioAnualizado: number
  capitalSeguradoMorte: number
  capitalSeguradoAh: number
}

export interface DivergenceResult {
  hasDivergence: boolean
  details: string
}

/** Relative difference between two numbers, floored at a R$1/unit absolute
 * base so tiny values don't produce noisy 100% differences. */
function relDiff(a: number, b: number): number {
  const base = Math.max(Math.abs(a), Math.abs(b), 1)
  return Math.abs(a - b) / base
}

// Money fields are self-typed by hand, so exact equality isn't realistic —
// only flag it once the gap is big enough to actually mean something (more
// than 5% off, or apólices count off by any amount, since that's a small
// whole number the consultor should know exactly).
const MONEY_DIVERGENCE_THRESHOLD = 0.05

/** Compares what a consultor self-reported for the week against what the
 * system computed automatically from their own appointments, and produces a
 * human-readable summary of any mismatch — used to flag the líder. */
export function compareSelfReport(self: SelfReportInput, computed: WeeklyReportRow): DivergenceResult {
  const issues: string[] = []
  if (self.apolicesCount !== computed.apolicesFechadas) {
    issues.push(`Apólices: informou ${self.apolicesCount}, sistema tem ${computed.apolicesFechadas}`)
  }
  if (relDiff(self.premioAnualizado, computed.valorApolices) > MONEY_DIVERGENCE_THRESHOLD) {
    issues.push(`Prêmio anualizado: informou ${fmtBRL(self.premioAnualizado)}, sistema tem ${fmtBRL(computed.valorApolices)}`)
  }
  if (relDiff(self.capitalSeguradoMorte, computed.capitalSegurado) > MONEY_DIVERGENCE_THRESHOLD) {
    issues.push(`Capital segurado (base): informou ${fmtBRL(self.capitalSeguradoMorte)}, sistema tem ${fmtBRL(computed.capitalSegurado)}`)
  }
  if (relDiff(self.capitalSeguradoAh, computed.capitalSeguradoAh) > MONEY_DIVERGENCE_THRESHOLD) {
    issues.push(`Capital segurado AH: informou ${fmtBRL(self.capitalSeguradoAh)}, sistema tem ${fmtBRL(computed.capitalSeguradoAh)}`)
  }
  return { hasDivergence: issues.length > 0, details: issues.join(' · ') }
}
