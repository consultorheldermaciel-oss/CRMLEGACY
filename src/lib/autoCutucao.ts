import { followupAlert, daysBetween } from './followup'
import { clientKey } from './domain'
import type { Appointment, Client, HotLead, Policy, Profile, Task } from './types'

const DEFAULT_GOALS = { naoProtocolado: 7, delay: 3, entrega: 30, recalibrar: 365 }
const DEFAULT_LEAD_FRIO_DAYS = 5

export interface AutoCutucaoCandidate {
  consultant_id: string
  assigned_by: string
  text: string
  deadline: string
  auto_kind: 'entrega' | 'recalibrar'
  auto_policy_id: string
}

export interface AutoLeadFrioCandidate {
  consultant_id: string
  assigned_by: string
  text: string
  deadline: string
  auto_kind: 'lead_frio'
  auto_lead_id: string
}

function todayStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Policies whose "entrega" or "recalibrar" deadline just came due, and that
 * don't already have a matching auto-task — ready to be inserted as a
 * Cutucão assigned by the consultor's líder. */
export function computeAutoCutucaoCandidates(
  policies: Policy[],
  consultants: Profile[],
  clients: Client[],
  tasks: Task[],
  today: Date,
): AutoCutucaoCandidate[] {
  const existing = new Set(tasks.filter((t) => t.auto_kind).map((t) => `${t.auto_policy_id}::${t.auto_kind}`))
  const deadline = todayStr(today)
  const candidates: AutoCutucaoCandidate[] = []

  for (const p of policies) {
    if (!p.issued_date) continue
    const consultant = consultants.find((c) => c.id === p.consultant_id)
    if (!consultant) continue
    const clientName = clients.find((c) => c.id === p.client_id)?.name ?? 'cliente sem nome cadastrado'
    const assignedBy = consultant.manager_id ?? consultant.id
    const goals = consultant.followup_goals ?? DEFAULT_GOALS

    if (p.status === 'ativa' && !existing.has(`${p.id}::entrega`)) {
      const alert = followupAlert('entrega', p.issued_date, goals, today)
      if (alert.overdue) {
        candidates.push({
          consultant_id: p.consultant_id,
          assigned_by: assignedBy,
          text: `⚠️ Entregar a apólice de ${p.product} de ${clientName} — passou de ${alert.limit} dias sem entrega.`,
          deadline,
          auto_kind: 'entrega',
          auto_policy_id: p.id,
        })
      }
    }

    if (p.status !== 'cancelada' && !existing.has(`${p.id}::recalibrar`)) {
      const alert = followupAlert('recalibrar', p.issued_date, goals, today)
      if (alert.overdue) {
        candidates.push({
          consultant_id: p.consultant_id,
          assigned_by: assignedBy,
          text: `🔄 Já faz ${alert.limit >= 365 ? '1 ano' : `${alert.limit} dias`} — hora de retornar pra recalibrar a apólice de ${p.product} de ${clientName}.`,
          deadline,
          auto_kind: 'recalibrar',
          auto_policy_id: p.id,
        })
      }
    }
  }
  return candidates
}

/** Lista HOT contacts that have sat with zero appointments for longer than
 * the consultor's configured threshold — ready to be inserted as a Cutucão
 * assigned by the consultor's líder, so a lead never just quietly goes cold
 * because nobody remembered to check the list. */
export function computeAutoLeadFrioCandidates(
  hotLeads: HotLead[],
  appointments: Appointment[],
  consultants: Profile[],
  tasks: Task[],
  today: Date,
): AutoLeadFrioCandidate[] {
  const existing = new Set(tasks.filter((t) => t.auto_kind === 'lead_frio').map((t) => t.auto_lead_id))
  const deadline = todayStr(today)
  const candidates: AutoLeadFrioCandidate[] = []

  const scheduledKeys = new Set(
    appointments.filter((a) => a.type !== 'evento').map((a) => clientKey(a.consultant_id, a.client_name)),
  )

  for (const lead of hotLeads) {
    if (existing.has(lead.id)) continue
    if (scheduledKeys.has(clientKey(lead.consultant_id, lead.name))) continue
    const consultant = consultants.find((c) => c.id === lead.consultant_id)
    if (!consultant) continue
    const limit = consultant.followup_goals?.leadFrio ?? DEFAULT_LEAD_FRIO_DAYS
    const days = daysBetween(lead.created_at.slice(0, 10), today)
    if (days < limit) continue

    candidates.push({
      consultant_id: lead.consultant_id,
      assigned_by: consultant.manager_id ?? consultant.id,
      text: `🔥 ${lead.name} está há ${days} dias na Lista HOT sem contato — hora de agendar!`,
      deadline,
      auto_kind: 'lead_frio',
      auto_lead_id: lead.id,
    })
  }
  return candidates
}
