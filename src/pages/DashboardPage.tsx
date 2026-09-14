import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { computeKpis, type Period } from '../lib/kpi'
import { resolveViewScope } from '../lib/viewScope'
import { apptTypeLabel } from '../lib/domain'
import { dateLabel } from '../lib/format'
import { AgendaPanel } from '../components/agenda/AgendaPanel'
import { HotPhoneModal } from '../components/modals/HotPhoneModal'
import { SelfReportModal } from '../components/modals/SelfReportModal'
import { ClientCardModal } from '../components/modals/ClientCardModal'

const PERIODS: [Period, string][] = [
  ['dia', 'Dia'],
  ['semana', 'Semana'],
  ['mes', 'Mês'],
  ['ano', 'Ano'],
]

function PeriodSelector({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1.5 bg-card border border-border p-1 rounded-[9px]">
      {PERIODS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold"
          style={{ background: period === key ? '#0B2D5B' : 'transparent', color: period === key ? '#fff' : '#1A1D23' }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const { consultants, appointments, updateAppointment } = useCrm()
  const { viewingId } = useUi()
  // Independent from agendaPeriod on purpose — picking a period for the KPI
  // numbers shouldn't jump the calendar below to match, and vice versa.
  const [kpiPeriod, setKpiPeriod] = useState<Period>('mes')
  const [agendaPeriod, setAgendaPeriod] = useState<Period>('mes')
  const [hotPhoneOpen, setHotPhoneOpen] = useState(false)
  const [selfReportOpen, setSelfReportOpen] = useState(false)
  const [inviteApptId, setInviteApptId] = useState<string | null>(null)

  const { isGestorView, team, memberIds } = resolveViewScope(consultants, viewingId)
  const scopeConsultants = isGestorView ? team : team.filter((c) => c.id === viewingId)
  const scopeAppointments = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  const kpis = computeKpis(scopeAppointments, scopeConsultants, kpiPeriod, new Date())

  // In-app fallback for the "⭐ Chamar o líder" invite: shows up here
  // regardless of whether the push notification actually arrived, so the
  // líder always has somewhere to see and act on pending invites.
  const pendingInvites = isGestorView
    ? scopeAppointments.filter((a) => a.wants_manager && (a.manager_response === 'pending' || !a.manager_response))
    : []
  const consultantById = new Map(consultants.map((c) => [c.id, c]))
  const invitedAppt = inviteApptId ? appointments.find((a) => a.id === inviteApptId) ?? null : null

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
      <div className="flex justify-between items-center flex-wrap gap-2.5 mb-3.5">
        <PeriodSelector period={kpiPeriod} onChange={setKpiPeriod} />
        {isGestorView && (
          <button
            type="button"
            onClick={() => setHotPhoneOpen(true)}
            className="bg-[#9C6B0A] text-white border-none rounded-lg px-3.5 py-2 text-[13px] font-bold whitespace-nowrap"
          >
            🔥 Hot Phone
          </button>
        )}
        {profile?.role === 'consultor' && (
          <button
            type="button"
            onClick={() => setSelfReportOpen(true)}
            className="bg-navy text-white border-none rounded-lg px-3.5 py-2 text-[13px] font-bold whitespace-nowrap"
          >
            📝 Meu relatório semanal
          </button>
        )}
      </div>

      {pendingInvites.length > 0 && (
        <div className="bg-[#FCEFD9] border border-[#F0D9A6] rounded-2xl p-4.5 mb-6">
          <div className="font-heading font-bold text-[15px] mb-3 text-[#9C6B0A]">
            ⭐ Convites pendentes ({pendingInvites.length})
          </div>
          <div className="flex flex-col gap-2.5">
            {pendingInvites.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <button
                  type="button"
                  onClick={() => setInviteApptId(a.id)}
                  className="bg-transparent border-none p-0 text-left flex-1 min-w-[180px]"
                >
                  <div className="text-[13px] font-semibold">
                    {consultantById.get(a.consultant_id)?.name.split(' ')[0] ?? 'Consultor'} · {a.client_name}
                  </div>
                  <div className="text-[11.5px] text-text-faint">
                    {apptTypeLabel(a)} · {dateLabel(a.date)} às {a.time}
                  </div>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateAppointment(a.id, { manager_response: 'accepted' })}
                    className="bg-[#1E7A46] text-white border-none rounded-lg px-3 py-1.5 text-[12px] font-bold"
                  >
                    ✅ Aceitar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAppointment(a.id, { manager_response: 'declined' })}
                    className="bg-[#B23030] text-white border-none rounded-lg px-3 py-1.5 text-[12px] font-bold"
                  >
                    ❌ Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {kpiSection}

      <div className="mb-3.5">
        <PeriodSelector period={agendaPeriod} onChange={setAgendaPeriod} />
      </div>
      <AgendaPanel period={agendaPeriod} />

      {hotPhoneOpen && <HotPhoneModal team={team} onClose={() => setHotPhoneOpen(false)} />}
      {selfReportOpen && <SelfReportModal onClose={() => setSelfReportOpen(false)} />}
      {invitedAppt && <ClientCardModal appt={invitedAppt} onClose={() => setInviteApptId(null)} />}
    </div>
  )
}
