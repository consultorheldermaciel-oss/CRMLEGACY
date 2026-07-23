import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { remuneracaoProjetada } from '../lib/kpi'
import { filterByPeriod } from '../lib/kpi'
import { CONSULTANT_COLOR_SWATCHES } from '../lib/types'

export function RemuneracaoPage() {
  const { profile } = useAuth()
  const { appointments, updateMyColor } = useCrm()
  const [colorBusy, setColorBusy] = useState(false)
  if (!profile) return null

  async function handlePickColor(color: string) {
    setColorBusy(true)
    await updateMyColor(color)
    setColorBusy(false)
  }

  const today = new Date()
  const monthAppts = filterByPeriod(
    appointments.filter((a) => a.consultant_id === profile.id),
    'mes',
    today,
  )
  const rem = remuneracaoProjetada(profile, monthAppts, today)

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-[#EAF0FA] border border-[#C7D7EE] text-[#0B2D5B] rounded-2xl px-5 py-4 text-[13px] font-semibold">
        🚀 Em breve: novas formas de acompanhar sua remuneração e seus resultados por aqui.
      </div>

      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
      <div className="rounded-2xl p-6.5 text-white" style={{ background: 'linear-gradient(135deg,#0B2D5B,#123A70)' }}>
        <div className="text-xs tracking-wide text-[#B9C4D6] mb-1.5">VALOR TOTAL PROJETADO (MÊS)</div>
        <div className="font-mono text-4xl font-semibold mb-4.5">
          R$ {rem.total.toLocaleString('pt-BR')}
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          {rem.breakdown.map((r) => (
            <div key={r.label} className="bg-white/10 rounded-[10px] p-3">
              <div className="text-[11px] text-[#B9C4D6] mb-1">{r.label}</div>
              <div className="font-mono text-[17px] font-semibold">{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="font-heading font-bold text-[15px] mb-3">PR Cadastro — mês {rem.pr.month} de 17</div>
        <div className="grid grid-cols-2 gap-3.5 mb-4">
          <div>
            <div className="text-[11.5px] text-text-muted mb-1.5">Apólices pagas acumuladas</div>
            <div className="bg-[#EFEDE6] rounded-md h-2.5 overflow-hidden mb-1">
              <div className="bg-green h-full" style={{ width: `${rem.pr.policiesPct}%` }} />
            </div>
            <div className="text-[11px] text-text-faint">{rem.pr.policiesPct}% da faixa</div>
          </div>
          <div>
            <div className="text-[11.5px] text-text-muted mb-1.5">Prêmio pago no trimestre</div>
            <div className="bg-[#EFEDE6] rounded-md h-2.5 overflow-hidden mb-1">
              <div className="bg-navy h-full" style={{ width: `${rem.pr.premiumPct}%` }} />
            </div>
            <div className="text-[11px] text-text-faint">{rem.pr.premiumPct}% da faixa</div>
          </div>
        </div>
        <div className="font-heading font-bold text-[15px] mb-2.5">Metas extras</div>
        <div className="flex flex-col gap-2.5">
          {profile.extra_goals.map((g, i) => (
            <div key={i} className="border border-border rounded-[10px] px-3.5 py-2.5">
              <div className="flex justify-between items-center text-[13px] font-semibold mb-1.5">
                <span>
                  {g.icon} {g.name}
                </span>
                <span>{g.pct}%</span>
              </div>
              <div className="bg-[#EFEDE6] rounded-md h-[7px] overflow-hidden">
                <div className="h-full" style={{ background: g.barColor, width: `${g.pct}%` }} />
              </div>
            </div>
          ))}
          {profile.extra_goals.length === 0 && (
            <div className="text-[12.5px] text-text-faint">Nenhuma meta extra definida pelo líder ainda.</div>
          )}
        </div>
      </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 max-w-[420px]">
        <div className="font-heading font-bold text-[15px] mb-1">Sua cor de identificação</div>
        <div className="text-[12px] text-text-faint mb-3">
          Aparece na sua agenda e no avatar — escolha a que preferir.
        </div>
        <div className="flex gap-2 flex-wrap">
          {CONSULTANT_COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              disabled={colorBusy}
              onClick={() => handlePickColor(color)}
              className="w-8 h-8 rounded-full disabled:opacity-60"
              style={{
                background: color,
                boxShadow: profile.color === color ? '0 0 0 2px #fff, 0 0 0 4px #1A1D23' : undefined,
              }}
              aria-label={`Usar cor ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
