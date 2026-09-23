import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { resolveViewScope } from '../lib/viewScope'
import { buildFunnelBoard, FUNNEL_STAGES, type FunnelCard, type FunnelStageKey } from '../lib/funnel'
import { ClientCardModal } from '../components/modals/ClientCardModal'

/** Visual pipeline (Lead → Entregue) across the whole team or a single
 * consultor, built entirely from existing hot_leads/appointments data — no
 * manual "move the card" step, since the stage is a consequence of what the
 * consultor actually did (scheduled, attended, closed, delivered). Clicking
 * a card jumps straight to the real record to take the next action. */
export function FunnelPage() {
  const { profile } = useAuth()
  const { consultants, hotLeads, appointments } = useCrm()
  const { viewingId, setScreen } = useUi()
  const [openApptId, setOpenApptId] = useState<string | null>(null)

  if (!profile) return null
  const { isGestorView, memberIds } = resolveViewScope(consultants, viewingId)
  const scopedHotLeads = memberIds ? hotLeads.filter((l) => memberIds.includes(l.consultant_id)) : hotLeads
  const scopedAppointments = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  const consultantById = new Map(consultants.map((c) => [c.id, c]))

  const board = buildFunnelBoard(scopedHotLeads, scopedAppointments, new Date())
  const openAppt = openApptId ? appointments.find((a) => a.id === openApptId) ?? null : null

  function handleCardClick(card: FunnelCard) {
    if (card.appointmentId) setOpenApptId(card.appointmentId)
    else setScreen('hotlist')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-heading font-bold text-[17px]">🎯 Funil</div>
        <div className="text-[12px] text-text-faint">
          Cada card avança sozinho conforme o agendamento acontece — clique num card pra abrir o cliente e dar o
          próximo passo.
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3.5" style={{ minWidth: FUNNEL_STAGES.length * 260 }}>
          {FUNNEL_STAGES.map((stageDef) => {
            const cards = board[stageDef.key]
            return (
              <FunnelColumn
                key={stageDef.key}
                stageKey={stageDef.key}
                label={stageDef.label}
                color={stageDef.color}
                cards={cards}
                isGestorView={isGestorView}
                consultantById={consultantById}
                onCardClick={handleCardClick}
              />
            )
          })}
        </div>
      </div>

      {openAppt && <ClientCardModal appt={openAppt} onClose={() => setOpenApptId(null)} />}
    </div>
  )
}

function FunnelColumn({
  stageKey,
  label,
  color,
  cards,
  isGestorView,
  consultantById,
  onCardClick,
}: {
  stageKey: FunnelStageKey
  label: string
  color: string
  cards: FunnelCard[]
  isGestorView: boolean
  consultantById: Map<string, { name: string }>
  onCardClick: (card: FunnelCard) => void
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 flex-1 min-w-[240px] flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-[12.5px] font-bold" style={{ color }}>
          {label}
        </div>
        <div className="text-[11px] font-bold text-text-faint bg-bg rounded-full px-2 py-0.5">{cards.length}</div>
      </div>
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onCardClick(card)}
            className="bg-white border rounded-xl px-3 py-2.5 text-left"
            style={{ borderColor: card.stale ? '#D64545' : '#E5E2D9' }}
          >
            <div className="text-[12.5px] font-semibold truncate">{card.clientName}</div>
            <div className="text-[11px] text-text-faint flex items-center gap-1.5 flex-wrap">
              {isGestorView && <span>{consultantById.get(card.consultantId)?.name.split(' ')[0] ?? '—'}</span>}
              <span style={{ color: card.stale ? '#B23030' : undefined, fontWeight: card.stale ? 700 : undefined }}>
                {card.daysSinceActivity > 0
                  ? `há ${card.daysSinceActivity} dia${card.daysSinceActivity > 1 ? 's' : ''}`
                  : card.daysSinceActivity === 0
                    ? 'hoje'
                    : 'em breve'}
              </span>
              {card.stale && stageKey !== 'lead' && <span>⚠️</span>}
            </div>
          </button>
        ))}
        {cards.length === 0 && <div className="text-[11.5px] text-text-faint px-1 py-2">Vazio.</div>}
      </div>
    </div>
  )
}
