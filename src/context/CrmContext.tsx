import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, functionErrorMessage } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Appointment, Dependent, Profile, Reminder, Task } from '../lib/types'

interface CrmState {
  consultants: Profile[]
  appointments: Appointment[]
  tasks: Task[]
  reminders: Reminder[]
  dependents: Dependent[]
  dismissedReminderIds: Set<string>
  loading: boolean
  refresh: () => Promise<void>
  createAppointment: (
    payload: Omit<Appointment, 'id' | 'created_at' | 'updated_at' | 'created_by'>,
  ) => Promise<Appointment | null>
  updateAppointment: (id: string, patch: Partial<Appointment>) => Promise<void>
  deleteAppointment: (id: string) => Promise<void>
  createTask: (payload: { consultant_id: string; text: string; deadline: string }) => Promise<void>
  markTaskDone: (id: string) => Promise<void>
  updateConsultant: (id: string, patch: Partial<Profile>) => Promise<void>
  removeConsultant: (id: string) => Promise<void>
  dismissReminder: (id: string) => Promise<void>
  createReminder: (payload: { icon: string; title: string; date: string }) => Promise<void>
  inviteConsultant: (payload: {
    name: string
    email: string
    roleToGrant?: 'consultor' | 'lider' | 'diretor'
  }) => Promise<{ error: string | null; inviteLink: string | null }>
  createDependent: (payload: { consultant_id: string; name: string; birth_date: string | null }) => Promise<void>
  updateDependent: (id: string, patch: Partial<Dependent>) => Promise<void>
  removeDependent: (id: string) => Promise<void>
  uploadAvatar: (consultantId: string, file: File) => Promise<{ error: string | null }>
}

const CrmContext = createContext<CrmState | undefined>(undefined)

export function CrmProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const [consultants, setConsultants] = useState<Profile[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dependents, setDependents] = useState<Dependent[]>([])
  const [dismissedReminderIds, setDismissedReminderIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!session) return
    setLoading(true)
    const [c, a, t, r, d, dep] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('appointments').select('*').order('date').order('time'),
      supabase.from('tasks').select('*').order('deadline'),
      supabase.from('reminders').select('*').order('date'),
      supabase.from('dismissed_reminders').select('reminder_id').eq('profile_id', session.user.id),
      supabase.from('dependents').select('*').order('created_at'),
    ])
    setConsultants((c.data as Profile[]) ?? [])
    setAppointments((a.data as Appointment[]) ?? [])
    setTasks((t.data as Task[]) ?? [])
    setReminders((r.data as Reminder[]) ?? [])
    setDismissedReminderIds(new Set((d.data ?? []).map((row) => row.reminder_id as string)))
    setDependents((dep.data as Dependent[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!session || !profile) {
      setLoading(false)
      return
    }
    refresh()

    const channel = supabase
      .channel('crm-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dependents' }, () => refresh())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, profile?.id])

  async function createAppointment(
    payload: Omit<Appointment, 'id' | 'created_at' | 'updated_at' | 'created_by'>,
  ) {
    if (!session) return null
    const { data, error } = await supabase
      .from('appointments')
      .insert({ ...payload, created_by: session.user.id })
      .select()
      .single()
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return null
    }
    await refresh()
    return data as Appointment
  }

  async function updateAppointment(id: string, patch: Partial<Appointment>) {
    const { error } = await supabase.from('appointments').update(patch).eq('id', id)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function deleteAppointment(id: string) {
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function createTask(payload: { consultant_id: string; text: string; deadline: string }) {
    if (!session) return
    const { error } = await supabase.from('tasks').insert({ ...payload, assigned_by: session.user.id })
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function markTaskDone(id: string) {
    const { error } = await supabase.from('tasks').update({ done: true }).eq('id', id)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function updateConsultant(id: string, patch: Partial<Profile>) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function removeConsultant(id: string) {
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function dismissReminder(id: string) {
    if (!session) return
    await supabase.from('dismissed_reminders').insert({ reminder_id: id, profile_id: session.user.id })
    setDismissedReminderIds((prev) => new Set(prev).add(id))
  }

  async function createReminder(payload: { icon: string; title: string; date: string }) {
    if (!session) return
    await supabase.from('reminders').insert({ ...payload, created_by: session.user.id })
    await refresh()
  }

  async function inviteConsultant(payload: { name: string; email: string }) {
    const appOrigin = window.location.origin
    const { data, error } = await supabase.functions.invoke('invite-consultor', {
      body: { ...payload, appOrigin },
    })
    if (error) return { error: await functionErrorMessage(error), inviteLink: null }
    if (data?.error) return { error: data.error as string, inviteLink: null }
    return { error: null, inviteLink: (data?.inviteLink as string) ?? null }
  }

  async function createDependent(payload: { consultant_id: string; name: string; birth_date: string | null }) {
    const { error } = await supabase.from('dependents').insert(payload)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function updateDependent(id: string, patch: Partial<Dependent>) {
    const { error } = await supabase.from('dependents').update(patch).eq('id', id)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function removeDependent(id: string) {
    const { error } = await supabase.from('dependents').delete().eq('id', id)
    if (error) console.error(error) // eslint-disable-line no-console
    await refresh()
  }

  async function uploadAvatar(consultantId: string, file: File) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${consultantId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) return { error: uploadError.message }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await updateConsultant(consultantId, { avatar_url: data.publicUrl })
    return { error: null }
  }

  const value = useMemo(
    () => ({
      consultants,
      appointments,
      tasks,
      reminders,
      dependents,
      dismissedReminderIds,
      loading,
      refresh,
      createAppointment,
      updateAppointment,
      deleteAppointment,
      createTask,
      markTaskDone,
      updateConsultant,
      removeConsultant,
      dismissReminder,
      createReminder,
      inviteConsultant,
      createDependent,
      updateDependent,
      removeDependent,
      uploadAvatar,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [consultants, appointments, tasks, reminders, dependents, dismissedReminderIds, loading],
  )

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>
}

export function useCrm() {
  const ctx = useContext(CrmContext)
  if (!ctx) throw new Error('useCrm must be used within CrmProvider')
  return ctx
}
