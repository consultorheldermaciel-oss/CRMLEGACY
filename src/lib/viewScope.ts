import type { Profile } from './types'

export interface ViewScope {
  /** Aggregate-style layout: whole-org view or a manager drilling into one unit. */
  isGestorView: boolean
  /** Consultores in scope — KPI roster, agenda columns, pickers. */
  team: Profile[]
  /** Profile ids to filter appointments/tasks/dependents by. Null = don't filter (use the RLS-scoped list as-is). */
  memberIds: string[] | null
}

/**
 * viewingId is 'gestor' (caller's own full scope), a lider's profile id (a
 * diretor drilling into that one unit), or a consultor's profile id
 * (single-consultant view) — resolve it into the scoping a page needs.
 */
export function resolveViewScope(consultants: Profile[], viewingId: string): ViewScope {
  if (viewingId === 'gestor') {
    return { isGestorView: true, team: consultants.filter((c) => c.role === 'consultor'), memberIds: null }
  }
  const viewingProfile = consultants.find((c) => c.id === viewingId)
  if (viewingProfile?.role === 'lider') {
    const unit = consultants.filter((c) => c.role === 'consultor' && c.manager_id === viewingId)
    return { isGestorView: true, team: unit, memberIds: [viewingId, ...unit.map((c) => c.id)] }
  }
  return { isGestorView: false, team: consultants.filter((c) => c.role === 'consultor'), memberIds: [viewingId] }
}
