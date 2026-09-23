import type { Appointment, HotLead } from './types'
import { clientKey } from './domain'
import { daysBetween } from './followup'

export type FunnelStageKey = 'lead' | 'abordagem' | 'aguardando_fechamento' | 'fechamento' | 'fechado' | 'entregue'

export const FUNNEL_STAGES: { key: FunnelStageKey; label: string; color: string }[] = [
  { key: 'lead', label: '🎯 Lead', color: '#6B7280' },
  { key: 'abordagem', label: '📅 Abordagem agendada', color: '#0B2D5B' },
  { key: 'aguardando_fechamento', label: '🤝 Aguardando fechamento', color: '#9C6B0A' },
  { key: 'fechamento', label: '💼 Fechamento agendado', color: '#1E7A8C' },
  { key: 'fechado', label: '🏆 Fechado', color: '#1E7A46' },
  { key: 'entregue', label: '✅ Entregue', color: '#1E7A46' },
]

// A card is flagged stale once it's been sitting this long without moving
// forward — only meaningful for the two "waiting on the next step" stages.
const STALE_DAYS = 5

export interface FunnelCard {
  key: string
  clientName: string
  consultantId: string
  stage: FunnelStageKey
  lastActivityDate: string
  daysSinceActivity: number
  appointmentId: string | null
  hotLeadId: string | null
  stale: boolean
}

/** Groups every lead/appointment into one client-level card per consultor,
 * placed in whichever stage reflects its furthest real progress — derived
 * entirely from existing data (hot_leads + appointments' type/status/
 * policy_closed/policy_delivered), nothing new to keep in sync by hand. */
export function buildFunnelBoard(
  hotLeads: HotLead[],
  appointments: Appointment[],
  today: Date,
): Record<FunnelStageKey, FunnelCard[]> {
  const board: Record<FunnelStageKey, FunnelCard[]> = {
    lead: [],
    abordagem: [],
    aguardando_fechamento: [],
    fechamento: [],
    fechado: [],
    entregue: [],
  }

  const relevantAppts = appointments.filter((a) => a.type !== 'evento')
  const apptsByClient = new Map<string, Appointment[]>()
  for (const a of relevantAppts) {
    const key = clientKey(a.consultant_id, a.client_name)
    const list = apptsByClient.get(key)
    if (list) list.push(a)
    else apptsByClient.set(key, [a])
  }

  for (const lead of hotLeads) {
    const key = clientKey(lead.consultant_id, lead.name)
    if (apptsByClient.has(key)) continue
    const date = lead.created_at.slice(0, 10)
    const days = daysBetween(date, today)
    board.lead.push({
      key,
      clientName: lead.name,
      consultantId: lead.consultant_id,
      stage: 'lead',
      lastActivityDate: date,
      daysSinceActivity: days,
      appointmentId: null,
      hotLeadId: lead.id,
      stale: days >= STALE_DAYS,
    })
  }

  for (const [key, appts] of apptsByClient) {
    const sorted = [...appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    const last = sorted[sorted.length - 1]
    const delivered = appts.find((a) => a.policy_delivered === true)
    const closed = appts.find((a) => a.policy_closed === true)
    const lastFechamento = [...sorted].reverse().find((a) => a.type === 'fechamento')
    const lastAbordagem = [...sorted].reverse().find((a) => a.type === 'abordagem')

    let stage: FunnelStageKey
    let anchor: Appointment
    if (delivered) {
      stage = 'entregue'
      anchor = delivered
    } else if (closed) {
      stage = 'fechado'
      anchor = closed
    } else if (lastFechamento) {
      stage = 'fechamento'
      anchor = lastFechamento
    } else if (lastAbordagem && lastAbordagem.status === 'compareceu') {
      stage = 'aguardando_fechamento'
      anchor = lastAbordagem
    } else {
      stage = 'abordagem'
      anchor = last
    }

    const days = daysBetween(anchor.date, today)
    board[stage].push({
      key,
      clientName: anchor.client_name,
      consultantId: anchor.consultant_id,
      stage,
      lastActivityDate: anchor.date,
      daysSinceActivity: days,
      appointmentId: anchor.id,
      hotLeadId: null,
      stale: (stage === 'abordagem' || stage === 'aguardando_fechamento') && days >= STALE_DAYS,
    })
  }

  for (const key of Object.keys(board) as FunnelStageKey[]) {
    board[key].sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
  }

  return board
}
