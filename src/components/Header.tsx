import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import type { Screen } from '../context/UiContext'
import { LogoMark } from './ui/LogoMark'
import { Avatar } from './ui/Avatar'
import { computeBirthdayReminders } from '../lib/birthdays'
import { CONSULTANT_COLOR_SWATCHES, isManagerRole } from '../lib/types'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Header() {
  const { profile, signOut } = useAuth()
  const { consultants, reminders, dependents, clients, tasks, dismissedReminderIds, dismissReminder, updateMyColor } = useCrm()
  const { viewingId, setViewingId, screen, setScreen } = useUi()
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorBusy, setColorBusy] = useState(false)
  const [colorError, setColorError] = useState<string | null>(null)

  if (!profile) return null

  async function handlePickColor(color: string) {
    setColorBusy(true)
    setColorError(null)
    const { error } = await updateMyColor(color)
    setColorBusy(false)
    if (error) setColorError(error)
    else setShowColorPicker(false)
  }
  const isLider = profile.role === 'lider'
  const isDiretor = profile.role === 'diretor'
  const isGestor = isManagerRole(profile.role)

  const scopedTasks = isGestor ? tasks : tasks.filter((t) => t.consultant_id === profile.id)
  const pendingTaskCount = scopedTasks.filter((t) => !t.done).length
  const birthdayReminders = computeBirthdayReminders(consultants, dependents, clients, new Date())

  const today = todayStr()
  const todayManualReminders = reminders.filter((r) => r.date === today && !dismissedReminderIds.has(r.id))
  const todayBirthdays = birthdayReminders.filter((r) => r.date === today)
  const todayReminders = [...todayManualReminders, ...todayBirthdays]
  const reminderCount =
    reminders.filter((r) => !dismissedReminderIds.has(r.id)).length + todayBirthdays.length + pendingTaskCount

  const liders = consultants.filter((c) => c.role === 'lider')
  const viewingConsultant = viewingId === 'gestor' ? null : consultants.find((c) => c.id === viewingId)
  const viewingIsUnit = viewingConsultant?.role === 'lider'
  const viewingLabel = isDiretor
    ? viewingId === 'gestor'
      ? 'Visão: Líder de agência (toda a operação)'
      : viewingIsUnit
        ? `Visão: unidade de ${viewingConsultant?.name ?? ''}`
        : `Visão: ${viewingConsultant?.name ?? ''}`
    : isLider
      ? viewingId === 'gestor'
        ? 'Visão: Líder de unidade (toda a equipe)'
        : `Visão: ${viewingConsultant?.name ?? ''}`
      : `Visão: ${profile.name}`

  const navDefs: [Screen, string][] = [['dashboard', 'Página principal'], ['carteira', 'Carteira de Clientes']]
  if (isGestor) navDefs.push(['equipe', 'Equipe'])
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
              <LogoMark size={22} />
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
            {isGestor ? (
              <>
                <button
                  type="button"
                  title={isDiretor ? 'Líder de agência (toda a operação)' : 'Líder de unidade (toda a equipe)'}
                  onClick={() => setViewingId('gestor')}
                  className="rounded-full p-0.5 shrink-0"
                  style={{ border: `2px solid ${viewingId === 'gestor' ? '#fff' : 'transparent'}` }}
                >
                  <Avatar profile={profile} size={38} />
                </button>
                {isDiretor &&
                  liders.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      title={`Unidade de ${l.name}`}
                      onClick={() => setViewingId(l.id)}
                      className="rounded-full p-0.5 shrink-0"
                      style={{ border: `2px solid ${viewingId === l.id ? '#fff' : 'transparent'}` }}
                    >
                      <Avatar profile={l} size={38} />
                    </button>
                  ))}
                {(isLider || viewingIsUnit) && (
                  <>
                    <div className="w-px h-[26px] bg-white/25 mx-0.5" />
                    {consultants
                      .filter((c) => c.role === 'consultor' && (isLider || c.manager_id === viewingId))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          title={c.name}
                          onClick={() => setViewingId(c.id)}
                          className="rounded-full p-0.5 shrink-0"
                          style={{ border: `2px solid ${viewingId === c.id ? '#fff' : 'transparent'}` }}
                        >
                          <Avatar profile={c} size={38} />
                        </button>
                      ))}
                  </>
                )}
              </>
            ) : (
              <div className="relative shrink-0">
                <button
                  type="button"
                  title="Escolher minha cor"
                  onClick={() => setShowColorPicker((v) => !v)}
                  className="rounded-full p-0.5 border-2 border-white shrink-0"
                >
                  <Avatar profile={profile} size={38} />
                </button>
                {showColorPicker && (
                  <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-lg p-3 z-50 w-[190px]">
                    <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">SUA COR</div>
                    <div className="flex gap-2 flex-wrap">
                      {CONSULTANT_COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          disabled={colorBusy}
                          onClick={() => handlePickColor(color)}
                          className="w-7 h-7 rounded-full disabled:opacity-60"
                          style={{
                            background: color,
                            boxShadow: profile.color === color ? '0 0 0 2px #fff, 0 0 0 4px #1A1D23' : undefined,
                          }}
                          aria-label={`Usar cor ${color}`}
                        />
                      ))}
                    </div>
                    {colorError && <div className="text-[11px] text-[#B23030] font-semibold mt-2">{colorError}</div>}
                  </div>
                )}
              </div>
            )}

            <div className="w-px h-[26px] bg-white/25 mx-1" />

            {isGestor && (
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
            onClick={() => todayManualReminders.forEach((r) => dismissReminder(r.id))}
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
