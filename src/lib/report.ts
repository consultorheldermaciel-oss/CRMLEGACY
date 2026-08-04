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
  recomendacoesAbordagem: number
  recomendacoesFechamento: number
  apolicesFechadas: number
  valorApolices: number
  capitalSegurado: number
}

export interface WeeklyReportTotals {
  abordagens: number
  fechamentos: number
  recomendacoesAbordagem: number
  recomendacoesFechamento: number
  apolicesFechadas: number
  valorApolices: number
  capitalSegurado: number
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
    }),
    {
      abordagens: 0,
      fechamentos: 0,
      recomendacoesAbordagem: 0,
      recomendacoesFechamento: 0,
      apolicesFechadas: 0,
      valorApolices: 0,
      capitalSegurado: 0,
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
  'Capital segurado (R$)',
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
