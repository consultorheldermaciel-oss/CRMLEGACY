import type { Dependent, Profile } from './types'
import { dstr } from './format'

export interface BirthdayReminder {
  id: string
  icon: string
  title: string
  date: string // next occurrence, YYYY-MM-DD
}

/** Next time this month/day happens on or after `today` (this year, or next year if already passed). */
export function nextOccurrence(birthDate: string, today: Date): string {
  const [, m, d] = birthDate.split('-').map(Number)
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let year = today.getFullYear()
  let occ = new Date(year, m - 1, d)
  if (occ < todayMidnight) {
    year += 1
    occ = new Date(year, m - 1, d)
  }
  return dstr(year, m - 1, d)
}

export function computeBirthdayReminders(
  consultants: Profile[],
  dependents: Dependent[],
  today: Date,
): BirthdayReminder[] {
  const items: BirthdayReminder[] = []
  consultants
    .filter((c) => c.role === 'consultor')
    .forEach((c) => {
      const first = c.name.split(' ')[0]
      if (c.birth_date) {
        items.push({
          id: `consultant:${c.id}`,
          icon: '🎂',
          title: `Aniversário — ${c.name}`,
          date: nextOccurrence(c.birth_date, today),
        })
      }
      if (c.spouse_birth_date && c.spouse_name) {
        items.push({
          id: `spouse:${c.id}`,
          icon: '💍',
          title: `Aniversário do cônjuge de ${first} — ${c.spouse_name}`,
          date: nextOccurrence(c.spouse_birth_date, today),
        })
      }
    })
  dependents.forEach((d) => {
    if (!d.birth_date) return
    const consultant = consultants.find((c) => c.id === d.consultant_id)
    const first = consultant?.name.split(' ')[0] ?? ''
    items.push({
      id: `dependent:${d.id}`,
      icon: '🎂',
      title: `Aniversário do(a) filho(a) de ${first} — ${d.name}`,
      date: nextOccurrence(d.birth_date, today),
    })
  })
  return items.sort((a, b) => a.date.localeCompare(b.date))
}
