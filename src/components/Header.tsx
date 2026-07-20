import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { initials } from '../lib/format'
import type { Screen } from '../context/UiContext'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Header() {
  const { profile, signOut } = useAuth()
  const { consultants, reminders, tasks, dismissedReminderIds, dismissReminder } = useCrm()
  const { viewingId, setViewingId, screen, setScreen } = useUi()

  if (!profile) return null
  const isLider = profile.role === 'lider'

  const scopedTasks = isLider ? tasks : tasks.filter((t) => t.consultant_id === profile.id)
  const pendingTaskCount = scopedTasks.filter((t) => !t.done).length
  const reminderCount = reminders.filter((r) => !dismissedReminderIds.has(r.id)).length + pendingTaskCount

  const today = todayStr()
  const todayReminders = reminders.filter((r) => r.date === today && !dismissedReminderIds.has(r.id))

  const viewingConsultant = viewingId === 'gestor' ? null : consultants.find((c) => c.id === viewingId)
  const viewingLabel = isLider
    ? viewingId === 'gestor'
      ? 'Visão: Líder de unidade (toda a equipe)'
      : `Visão: ${viewingConsultant?.name ?? ''}`
    : `Visão: ${profile.name}`

  const navDefs: [Screen, string][] = [['dashboard', 'Dashboard']]
  if (isLider) navDefs.push(['equipe', 'Equipe'])
  else navDefs.push(['remuneracao', 'Minha remuneração'])
  navDefs.push(['lembretes', 'Lembretes'])

  return (
    <>
      <header
        className="px-4 sm:px-7 py-4 flex flex-col gap-3.5"
        style={{ background: 'linear-gradient(100deg,#10182B 0%,#0B2D5B 55%,#1E5C46 130%)' }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-[10px] bg-[#1C2230] flex items-center justify-center shrink-0">
              <div className="w-5 h-5 relative">
                <div className="absolute inset-0 border-[3px] border-white rotate-45 rounded-[3px]" />
                <div className="absolute inset-1 border-[3px] border-white rounded-[2px]" />
              </div>
            </div>
            <div>
              <div className="font-heading font-extrabold text-[19px] text-white tracking-wide leading-none">
                LEGACY
              </div>
              <div className="text-[10px] text-[#B9C4D6] tracking-[1.5px] mt-0.5">
                GESTÃO E DESENVOLVIMENTO
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isLider ? (
              <>
                <button
                  type="button"
                  title="Líder de unidade (toda a equipe)"
                  onClick={() => setViewingId('gestor')}
                  className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-[13px] text-white shrink-0"
                  style={{
                    background: '#1C2230',
                    border: `2px solid ${viewingId === 'gestor' ? '#fff' : 'transparent'}`,
                  }}
                >
                  {initials(profile.name || 'Líder')}
                </button>
                {consultants
                  .filter((c) => c.role === 'consultor')
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.name}
                      onClick={() => setViewingId(c.id)}
                      className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-[13px] text-white shrink-0"
                      style={{ background: c.color, border: `2px solid ${viewingId === c.id ? '#fff' : 'transparent'}` }}
                    >
                      {initials(c.name)}
                    </button>
                  ))}
              </>
            ) : (
              <div
                title={profile.name}
                className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-[13px] text-white shrink-0 border-2 border-white"
                style={{ background: profile.color }}
              >
                {initials(profile.name)}
              </div>
            )}

            <div className="w-px h-[26px] bg-white/25 mx-1" />

            {isLider && (
              <button
                type="button"
                onClick={() => setScreen('equipe')}
                className="bg-white/10 text-white border border-white/25 rounded-lg px-3.5 py-2 text-[13px] font-semibold hover:bg-white/20"
              >
                Gerenciar equipe
              </button>
            )}

            <button
              type="button"
              onClick={() => setScreen('lembretes')}
              className="relative bg-white/10 text-white border border-white/25 rounded-lg w-[38px] h-[38px] flex items-center justify-center text-base hover:bg-white/20"
            >
              🔔
              {reminderCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#D64545] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-[#0B2D5B]">
                  {reminderCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={signOut}
              className="bg-white/10 text-white border border-white/25 rounded-lg px-3 py-2 text-[13px] font-semibold hover:bg-white/20"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="font-heading text-white text-[15px] font-bold">{viewingLabel}</div>
        </div>
      </header>

      {todayReminders.length > 0 && (
        <div className="bg-[#D64545] text-white px-4 sm:px-7 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">
            🎂 {todayReminders.map((r) => r.title).join(' · ')}
          </div>
          <button
            type="button"
            onClick={() => todayReminders.forEach((r) => dismissReminder(r.id))}
            className="bg-white/20 text-white border border-white/40 rounded-md px-3 py-1.5 text-[13px] font-semibold"
          >
            Já mandei mensagem
          </button>
        </div>
      )}

      <div className="flex gap-1 px-4 sm:px-7 pt-3.5 border-b border-border bg-bg overflow-x-auto">
        {navDefs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScreen(key)}
            className="bg-transparent px-3.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap border-b-2"
            style={{
              color: screen === key ? '#0B2D5B' : '#6B7280',
              borderColor: screen === key ? '#0B2D5B' : 'transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )
}
