import { useState } from 'react'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { computeKpis, type Period } from '../lib/kpi'
import { resolveViewScope } from '../lib/viewScope'
import { AgendaPanel } from '../components/agenda/AgendaPanel'
import { HotPhoneModal } from '../components/modals/HotPhoneModal'

const PERIODS: [Period, string][] = [
  ['dia', 'Dia'],
  ['semana', 'Semana'],
  ['mes', 'Mês'],
  ['ano', 'Ano'],
]

export function DashboardPage() {
  const { consultants, appointments } = useCrm()
  const { viewingId } = useUi()
  const [period, setPeriod] = useState<Period>('mes')
  const [hotPhoneOpen, setHotPhoneOpen] = useState(false)

  const { isGestorView, team, memberIds } = resolveViewScope(consultants, viewingId)
  const scopeConsultants = isGestorView ? team : team.filter((c) => c.id === viewingId)
  const scopeAppointments = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  const kpis = computeKpis(scopeAppointments, scopeConsultants, period, new Date())

  const periodSelector = (
    <div className="flex justify-between items-center flex-wrap gap-2.5 mb-3.5">
      <div className="flex gap-1.5 bg-card border border-border p-1 rounded-[9px]">
        {PERIODS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className="rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold"
            style={{ background: period === key ? '#0B2D5B' : 'transparent', color: period === key ? '#fff' : '#1A1D23' }}
          >
            {label}
          </button>
        ))}
      </div>
      {isGestorView && (
        <button
          type="button"
          onClick={() => setHotPhoneOpen(true)}
          className="bg-[#9C6B0A] text-white border-none rounded-lg px-3.5 py-2 text-[13px] font-bold whitespace-nowrap"
        >
          🔥 Hot Phone
        </button>
      )}
    </div>
  )

  const kpiSection = isGestorView ? (
    <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
      {kpis.map((k) => (
        <div key={k.key} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-lg">{k.icon}</div>
            {k.hasTarget && <div className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: k.dotColor }} />}
          </div>
          <div className="text-[12.5px] text-text-muted font-semibold leading-tight">{k.label}</div>
          <div className="font-mono text-2xl font-semibold">{k.value}</div>
          {k.hasTarget && <div className="text-[11px] text-text-faint">meta: {k.target}</div>}
        </div>
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-2.5 mb-6">
      {kpis.map((k) => (
        <div key={k.key} className="bg-card border border-border rounded-xl px-4.5 py-3.5 flex items-center gap-4">
          <div className="text-[22px] w-7 text-center shrink-0">{k.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2.5 mb-1.5">
              <div className="text-[13px] font-semibold">{k.label}</div>
              <div className="font-mono text-lg font-bold shrink-0">{k.value}</div>
            </div>
            <div
              className="rounded-md h-2.5 relative overflow-hidden"
              style={{ background: 'linear-gradient(90deg,#D64545,#E0A526,#3FA66B)' }}
            >
              <div className="absolute top-0 bottom-0 right-0 bg-[#EFEDE6]" style={{ width: `${k.barMaskPct}%` }} />
            </div>
            {k.hasTarget && <div className="text-[11px] text-text-faint mt-1">meta: {k.target}</div>}
          </div>
          {k.hasTarget && (
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ background: k.dotColor, boxShadow: `0 0 0 3px ${k.dotColor}22` }}
            />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col">
      {periodSelector}
      {isGestorView ? (
        <>
          {kpiSection}
          <AgendaPanel period={period} />
        </>
      ) : (
        <>
          <div className="mb-6">
            <AgendaPanel period={period} />
          </div>
          {kpiSection}
        </>
      )}

      {hotPhoneOpen && <HotPhoneModal team={team} onClose={() => setHotPhoneOpen(false)} />}
    </div>
  )
}
