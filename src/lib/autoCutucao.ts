import { followupAlert } from './followup'
import type { Policy, Profile, Task } from './types'

const DEFAULT_GOALS = { naoProtocolado: 7, delay: 3, entrega: 30, recalibrar: 365 }

export interface AutoCutucaoCandidate {
  consultant_id: string
  assigned_by: string
  text: string
  deadline: string
  auto_kind: 'entrega' | 'recalibrar'
  auto_policy_id: string
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
    const assignedBy = consultant.manager_id ?? consultant.id
    const goals = consultant.followup_goals ?? DEFAULT_GOALS

    if (p.status === 'ativa' && !existing.has(`${p.id}::entrega`)) {
      const alert = followupAlert('entrega', p.issued_date, goals, today)
      if (alert.overdue) {
        candidates.push({
          consultant_id: p.consultant_id,
          assigned_by: assignedBy,
          text: `⚠️ Entregar a apólice de ${p.product} — passou de ${alert.limit} dias sem entrega.`,
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
          text: `🔄 Já faz ${alert.limit >= 365 ? '1 ano' : `${alert.limit} dias`} — hora de retornar pra recalibrar a apólice de ${p.product}.`,
          deadline,
          auto_kind: 'recalibrar',
          auto_policy_id: p.id,
        })
      }
    }
  }
  return candidates
}
