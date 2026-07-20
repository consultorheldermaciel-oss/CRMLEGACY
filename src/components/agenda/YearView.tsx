import { MONTHS } from '../../lib/format'
import type { Appointment } from '../../lib/types'

export function YearView({ appointments }: { appointments: Appointment[] }) {
  const year = new Date().getFullYear()
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
      {MONTHS.map((label, idx) => {
        const monthApps = appointments.filter((a) => {
          const [y, m] = a.date.split('-').map(Number)
          return y === year && m - 1 === idx
        })
        const ab = monthApps.filter((a) => a.type === 'abordagem').length
        const fe = monthApps.filter((a) => a.type === 'fechamento').length
        const pol = monthApps.filter((a) => a.policy_closed).length
        const max = Math.max(ab, fe, pol, 1)
        const bars = [
          { color: '#0B2D5B', v: ab },
          { color: '#3FA66B', v: fe },
          { color: '#C9A227', v: pol },
        ]
        return (
          <div key={label} className="border border-border rounded-[10px] p-2.5">
            <div className="text-xs font-bold mb-1.5">{label}</div>
            <div className="flex items-end gap-0.5" style={{ height: 36 }}>
              {bars.map((b, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ background: b.color, height: (b.v / max) * 32 + 4 }}
                />
              ))}
            </div>
            <div className="text-[10px] text-text-faint mt-1">{monthApps.length} compromissos</div>
          </div>
        )
      })}
    </div>
  )
}
