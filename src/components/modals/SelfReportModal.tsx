import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCrm } from '../../context/CrmContext'
import { Modal, ModalHeader } from '../ui/Modal'
import { formatCurrencyTyped, parseCurrency } from '../../lib/format'
import { weekRange } from '../../lib/report'

/** Lets a consultor self-report their own weekly numbers — quantidade de
 * apólices, prêmio anualizado, capital segurado de morte/base, e capital
 * segurado AH — which get cross-checked against what the system computed
 * automatically for that same week (see CrmContext.submitSelfReport /
 * lib/report.ts compareSelfReport). Divergences flag the líder. */
export function SelfReportModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const { submitSelfReport, selfReports } = useCrm()
  const [anchor, setAnchor] = useState(() => new Date())
  const { start, startDate, endDate } = weekRange(anchor)

  const existing = selfReports.find((r) => r.consultant_id === profile?.id && r.week_start === start)
  const asCentsStr = (v: number) => String(Math.round(v * 100))

  const [apolices, setApolices] = useState('')
  const [premio, setPremio] = useState('')
  const [morte, setMorte] = useState('')
  const [ah, setAh] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ error: string | null; hasDivergence: boolean } | null>(null)

  // Re-sync the form whenever the selected week changes, so navigating with
  // ‹ › loads that week's already-saved numbers instead of leaving stale
  // values from whichever week was showing before.
  useEffect(() => {
    setApolices(String(existing?.apolices_count ?? ''))
    setPremio(existing ? formatCurrencyTyped(asCentsStr(existing.premio_anualizado)) : '')
    setMorte(existing ? formatCurrencyTyped(asCentsStr(existing.capital_segurado_morte)) : '')
    setAh(existing ? formatCurrencyTyped(asCentsStr(existing.capital_segurado_ah)) : '')
    setResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, existing?.id])

  function shiftWeek(delta: number) {
    setAnchor((a) => {
      const d = new Date(a)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
  }

  async function handleSubmit() {
    if (!profile) return
    setSaving(true)
    const res = await submitSelfReport(start, {
      apolicesCount: Number(apolices) || 0,
      premioAnualizado: parseCurrency(premio),
      capitalSeguradoMorte: parseCurrency(morte),
      capitalSeguradoAh: parseCurrency(ah),
    })
    setSaving(false)
    setResult(res)
  }

  const periodLabel = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="📝 Meu relatório semanal" onClose={onClose} />

      <div className="flex items-center justify-center gap-3 mb-4">
        <button type="button" onClick={() => shiftWeek(-1)} className="text-text-muted px-2 font-bold">
          ‹
        </button>
        <div className="text-center font-heading font-bold text-sm">Semana de {periodLabel}</div>
        <button type="button" onClick={() => shiftWeek(1)} className="text-text-muted px-2 font-bold">
          ›
        </button>
      </div>

      <div className="text-[12.5px] text-text-muted mb-4">
        Preencha os números que você fechou nessa semana. O sistema compara com o que já está registrado nos seus
        agendamentos — se der alguma diferença, seu líder é avisado.
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Quantidade de apólices
          <input
            type="number"
            min={0}
            value={apolices}
            onChange={(e) => setApolices(e.target.value)}
            placeholder="0"
            className="border border-[#D8D5CD] rounded-lg px-3 py-2 text-[13px]"
          />
        </label>
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Prêmio anualizado (R$)
          <input
            value={premio}
            onChange={(e) => setPremio(formatCurrencyTyped(e.target.value))}
            placeholder="R$ 0,00"
            className="border border-[#D8D5CD] rounded-lg px-3 py-2 text-[13px]"
          />
        </label>
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Capital segurado — capital de morte / base (R$)
          <input
            value={morte}
            onChange={(e) => setMorte(formatCurrencyTyped(e.target.value))}
            placeholder="R$ 0,00"
            className="border border-[#D8D5CD] rounded-lg px-3 py-2 text-[13px]"
          />
        </label>
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Capital segurado AH — acidentes e saúde (R$)
          <input
            value={ah}
            onChange={(e) => setAh(formatCurrencyTyped(e.target.value))}
            placeholder="R$ 0,00"
            className="border border-[#D8D5CD] rounded-lg px-3 py-2 text-[13px]"
          />
        </label>
      </div>

      {result && !result.error && (
        <div
          className="rounded-lg px-3 py-2.5 text-[12.5px] font-semibold mb-4"
          style={
            result.hasDivergence
              ? { background: '#FCEFD9', color: '#9C6B0A' }
              : { background: '#E4F5EA', color: '#1E7A46' }
          }
        >
          {result.hasDivergence
            ? '⚠️ Salvo — encontramos uma diferença em relação ao sistema, seu líder foi avisado.'
            : '✅ Salvo — bateu certinho com o sistema!'}
        </div>
      )}
      {result?.error && (
        <div className="bg-[#FBE7E7] text-[#B23030] rounded-lg px-3 py-2.5 text-[12.5px] font-semibold mb-4">
          {result.error}
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSubmit}
        className="bg-navy text-white border-none rounded-lg px-4 py-2.5 text-sm font-bold w-full disabled:opacity-60"
      >
        {saving ? 'Salvando…' : existing ? 'Atualizar relatório' : 'Enviar relatório'}
      </button>
    </Modal>
  )
}
