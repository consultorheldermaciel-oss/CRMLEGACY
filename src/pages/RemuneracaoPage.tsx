import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { remuneracaoProjetada, filterByPeriod } from '../lib/kpi'

export function RemuneracaoPage() {
  const { profile } = useAuth()
  const { appointments } = useCrm()
  if (!profile) return null

  if (profile.contract_template !== 'metlife_2025') {
    return (
      <div className="bg-[#EAF0FA] border border-[#C7D7EE] text-[#0B2D5B] rounded-2xl px-5 py-4 text-[13px] font-semibold max-w-[560px]">
        🚀 Em breve: novas formas de acompanhar sua remuneração e seus resultados por aqui.
      </div>
    )
  }

  const today = new Date()
  const monthAppts = filterByPeriod(
    appointments.filter((a) => a.consultant_id === profile.id),
    'mes',
    today,
  )
  const rem = remuneracaoProjetada(profile, monthAppts, today)

  return (
    <div className="grid gap-5 items-start" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
      <div className="rounded-2xl p-6.5 text-white" style={{ background: 'linear-gradient(135deg,#0B2D5B,#123A70)' }}>
        <div className="text-xs tracking-wide text-[#B9C4D6] mb-1.5">VALOR TOTAL PROJETADO (MÊS)</div>
        <div className="font-mono text-4xl font-semibold mb-4.5">R$ {rem.total.toLocaleString('pt-BR')}</div>
        <div className="grid grid-cols-2 gap-3.5">
          {rem.breakdown.map((r) => (
            <div key={r.label} className="bg-white/10 rounded-[10px] p-3">
              <div className="text-[11px] text-[#B9C4D6] mb-1">{r.label}</div>
              <div className="font-mono text-[17px] font-semibold">{r.value}</div>
            </div>
          ))}
        </div>
        {rem.commissionNote && <div className="text-[11px] text-[#B9C4D6] mt-3">{rem.commissionNote}</div>}
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
        <div className="text-[11px] text-text-faint">
          Comissão de renovação (2º ao 4º ano), PR de Evolução, PR de Desempenho e PR de Permanência ainda não
          entram nesse cálculo — dependem do histórico de pagamento das apólices ao longo dos anos, que o app
          ainda não acompanha.
        </div>
      </div>
    </div>
  )
}
