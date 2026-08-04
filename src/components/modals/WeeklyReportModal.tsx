import { useState } from 'react'
import { useCrm } from '../../context/CrmContext'
import { Modal } from '../ui/Modal'
import { LogoMark } from '../ui/LogoMark'
import { fmtBRL } from '../../lib/format'
import { buildWeeklyReport, downloadCsv, weeklyReportCsv, weekRange } from '../../lib/report'
import type { Profile } from '../../lib/types'

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function WeeklyReportModal({ team, onClose }: { team: Profile[]; onClose: () => void }) {
  const { appointments } = useCrm()
  const [anchor, setAnchor] = useState(() => new Date())
  const { start, end, startDate, endDate } = weekRange(anchor)
  const { rows, totals, averages } = buildWeeklyReport(appointments, team, start, end)

  function shiftWeek(delta: number) {
    setAnchor((a) => {
      const d = new Date(a)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
  }

  function handleDownloadCsv() {
    const csv = weeklyReportCsv(rows, totals, averages, start, end)
    downloadCsv(`relatorio-produtividade-${start}-a-${end}.csv`, csv)
  }

  const periodLabel = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`

  return (
    <Modal onClose={onClose} maxWidth={880}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <div>
            <div className="font-heading font-bold text-[13px] leading-tight">Legacy — Gestão e Desenvolvimento</div>
            <div className="font-heading font-bold text-lg leading-tight">Relatório semanal de produtividade</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="bg-transparent border-none text-2xl text-text-faint no-print">
          ×
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 mb-4 no-print">
        <button type="button" onClick={() => shiftWeek(-1)} className="text-text-muted px-2 font-bold">
          ‹
        </button>
        <div className="text-center font-heading font-bold text-sm">Semana de {periodLabel}</div>
        <button type="button" onClick={() => shiftWeek(1)} className="text-text-muted px-2 font-bold">
          ›
        </button>
      </div>

      <div className="text-[12.5px] text-text-muted mb-3 hidden print:block">Semana de {periodLabel}</div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-2 font-bold">Consultor</th>
              <th className="text-right py-2 px-2 font-bold">Abordagens</th>
              <th className="text-right py-2 px-2 font-bold">Fechamentos</th>
              <th className="text-right py-2 px-2 font-bold">Recomendações (abordagem)</th>
              <th className="text-right py-2 px-2 font-bold">Recomendações (fechamento)</th>
              <th className="text-right py-2 px-2 font-bold">Apólices fechadas</th>
              <th className="text-right py-2 px-2 font-bold">Valor das apólices</th>
              <th className="text-right py-2 pl-2 font-bold">Capital segurado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.consultantId} className="border-b border-border">
                <td className="py-2 pr-2 font-semibold">{r.consultantName}</td>
                <td className="text-right py-2 px-2">{r.abordagens}</td>
                <td className="text-right py-2 px-2">{r.fechamentos}</td>
                <td className="text-right py-2 px-2">{r.recomendacoesAbordagem}</td>
                <td className="text-right py-2 px-2">{r.recomendacoesFechamento}</td>
                <td className="text-right py-2 px-2">{r.apolicesFechadas}</td>
                <td className="text-right py-2 px-2">{fmtBRL(r.valorApolices)}</td>
                <td className="text-right py-2 pl-2">{fmtBRL(r.capitalSegurado)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-text-faint">
                  Nenhum consultor na equipe.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1A1D23] font-bold">
              <td className="py-2 pr-2">EQUIPE (total)</td>
              <td className="text-right py-2 px-2">{totals.abordagens}</td>
              <td className="text-right py-2 px-2">{totals.fechamentos}</td>
              <td className="text-right py-2 px-2">{totals.recomendacoesAbordagem}</td>
              <td className="text-right py-2 px-2">{totals.recomendacoesFechamento}</td>
              <td className="text-right py-2 px-2">{totals.apolicesFechadas}</td>
              <td className="text-right py-2 px-2">{fmtBRL(totals.valorApolices)}</td>
              <td className="text-right py-2 pl-2">{fmtBRL(totals.capitalSegurado)}</td>
            </tr>
            <tr className="text-text-muted italic">
              <td className="py-2 pr-2">Média por consultor</td>
              <td className="text-right py-2 px-2">{round1(averages.abordagens)}</td>
              <td className="text-right py-2 px-2">{round1(averages.fechamentos)}</td>
              <td className="text-right py-2 px-2">{round1(averages.recomendacoesAbordagem)}</td>
              <td className="text-right py-2 px-2">{round1(averages.recomendacoesFechamento)}</td>
              <td className="text-right py-2 px-2">{round1(averages.apolicesFechadas)}</td>
              <td className="text-right py-2 px-2">{fmtBRL(averages.valorApolices)}</td>
              <td className="text-right py-2 pl-2">{fmtBRL(averages.capitalSegurado)}</td>
            </tr>
            <tr>
              <td className="py-2 pr-2 font-semibold">Prêmio médio por apólice fechada</td>
              <td colSpan={7} className="text-right py-2 px-2 font-semibold">
                {fmtBRL(totals.premioMedio)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex gap-3 flex-wrap no-print">
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-navy text-white border-none rounded-lg px-3.5 py-2.5 text-[13px] font-bold"
        >
          🖨️ Baixar PDF
        </button>
        <button
          type="button"
          onClick={handleDownloadCsv}
          className="bg-green text-white border-none rounded-lg px-3.5 py-2.5 text-[13px] font-bold"
        >
          📊 Baixar Excel
        </button>
      </div>
    </Modal>
  )
}
