import type { Appointment, Profile } from './types'
import { dstr } from './format'

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
  recomendacoes: number
  apolicesFechadas: number
  valorApolices: number
  capitalSegurado: number
}

export interface WeeklyReportTotals {
  abordagens: number
  fechamentos: number
  recomendacoes: number
  apolicesFechadas: number
  valorApolices: number
  capitalSegurado: number
  premioMedio: number
}

export function buildWeeklyReport(
  appointments: Appointment[],
  team: Profile[],
  weekStart: string,
  weekEnd: string,
): { rows: WeeklyReportRow[]; totals: WeeklyReportTotals } {
  const rows: WeeklyReportRow[] = team.map((c) => {
    const apps = appointments.filter((a) => a.consultant_id === c.id && a.date >= weekStart && a.date <= weekEnd)
    const closed = apps.filter((a) => a.policy_closed)
    return {
      consultantId: c.id,
      consultantName: c.name,
      abordagens: apps.filter((a) => a.type === 'abordagem').length,
      fechamentos: apps.filter((a) => a.type === 'fechamento').length,
      recomendacoes: apps.reduce((s, a) => s + (a.recommendations || 0), 0),
      apolicesFechadas: closed.length,
      valorApolices: closed.reduce((s, a) => s + (a.premium || 0), 0),
      capitalSegurado: closed.reduce((s, a) => s + (a.capital_segurado || 0), 0),
    }
  })

  const totals = rows.reduce(
    (acc, r) => ({
      abordagens: acc.abordagens + r.abordagens,
      fechamentos: acc.fechamentos + r.fechamentos,
      recomendacoes: acc.recomendacoes + r.recomendacoes,
      apolicesFechadas: acc.apolicesFechadas + r.apolicesFechadas,
      valorApolices: acc.valorApolices + r.valorApolices,
      capitalSegurado: acc.capitalSegurado + r.capitalSegurado,
    }),
    { abordagens: 0, fechamentos: 0, recomendacoes: 0, apolicesFechadas: 0, valorApolices: 0, capitalSegurado: 0 },
  )

  return {
    rows,
    totals: {
      ...totals,
      premioMedio: totals.apolicesFechadas ? Math.round(totals.valorApolices / totals.apolicesFechadas) : 0,
    },
  }
}

const CSV_HEADERS = [
  'Consultor',
  'Abordagens',
  'Fechamentos',
  'Recomendações',
  'Apólices fechadas',
  'Valor das apólices (R$)',
  'Capital segurado (R$)',
]

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A .csv opens directly in Excel with no extra library, so this covers "quero
 * em Excel também" without adding a client-side spreadsheet-writing
 * dependency (the maintained ones either have unpatched CVEs or add real
 * bundle weight for what's ultimately a flat table). */
export function weeklyReportCsv(rows: WeeklyReportRow[], totals: WeeklyReportTotals, weekStart: string, weekEnd: string): string {
  const lines = [
    `Relatório de produtividade — semana de ${weekStart} a ${weekEnd}`,
    '',
    CSV_HEADERS.map(csvCell).join(';'),
    ...rows.map((r) =>
      [r.consultantName, r.abordagens, r.fechamentos, r.recomendacoes, r.apolicesFechadas, r.valorApolices, r.capitalSegurado]
        .map(csvCell)
        .join(';'),
    ),
    ['EQUIPE (total)', totals.abordagens, totals.fechamentos, totals.recomendacoes, totals.apolicesFechadas, totals.valorApolices, totals.capitalSegurado]
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
