import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

export type Screen = 'dashboard' | 'equipe' | 'remuneracao' | 'lembretes'

interface TaskModalState {
  open: boolean
  consultantId: string | null
  prefillDeadline: string
}

interface UiState {
  viewingId: string // 'gestor' or a consultant profile id
  setViewingId: (id: string) => void
  screen: Screen
  setScreen: (s: Screen) => void
  taskModal: TaskModalState
  openTaskModal: (consultantId: string, prefillDeadline?: string) => void
  closeTaskModal: () => void
}

const UiContext = createContext<UiState | undefined>(undefined)

export function UiProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [viewingId, setViewingId] = useState<string>('gestor')
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [taskModal, setTaskModal] = useState<TaskModalState>({
    open: false,
    consultantId: null,
    prefillDeadline: '',
  })

  useEffect(() => {
    if (profile?.role === 'consultor') setViewingId(profile.id)
  }, [profile?.id, profile?.role])

  function openTaskModal(consultantId: string, prefillDeadline = '') {
    setTaskModal({ open: true, consultantId, prefillDeadline })
  }
  function closeTaskModal() {
    setTaskModal((s) => ({ ...s, open: false }))
  }

  return (
    <UiContext.Provider
      value={{ viewingId, setViewingId, screen, setScreen, taskModal, openTaskModal, closeTaskModal }}
    >
      {children}
    </UiContext.Provider>
  )
}

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used within UiProvider')
  return ctx
}
