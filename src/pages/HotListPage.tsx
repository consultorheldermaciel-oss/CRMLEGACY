import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { toTitleCase } from '../lib/format'
import { AGENDA_START_HOUR } from '../lib/domain'
import { downloadCsv } from '../lib/report'
import { parseHotListFile } from '../lib/hotListImport'
import { hotLeadStatus } from '../lib/hotListStatus'
import type { Appointment, HotLead, HotLeadSource } from '../lib/types'
import { Modal, ModalHeader } from '../components/ui/Modal'
import { DayView } from '../components/agenda/DayView'
import { NewAppointmentModal } from '../components/modals/NewAppointmentModal'
import { ClientCardModal } from '../components/modals/ClientCardModal'
import { ConflictAlertModal } from '../components/modals/ConflictAlertModal'

const TEMPLATE_CSV =
  'Nome;Telefone;Fonte;Recomendado por;Outras características\r\n' +
  'João da Silva;(11) 99999-0000;Mercado;;Trabalha no comércio, mencionou querer proteger a família\r\n' +
  'Maria Souza;(11) 98888-0000;Recomendação;João da Silva;Amiga da Maria, tem dois filhos pequenos\r\n'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function HotListPage() {
  const { profile } = useAuth()
  const { consultants, hotLeads, appointments, createHotLeadsBulk, removeHotLead } = useCrm()
  const { viewingId } = useUi()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newApptSlot, setNewApptSlot] = useState<{ consultantIds: string[]; date: string; time: string; prefillClientName?: string } | null>(
    null,
  )
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null)
  const [conflictAppt, setConflictAppt] = useState<Appointment | null>(null)

  if (!profile) return null
  const targetConsultant = consultants.find((c) => c.id === viewingId)
  const canManage = viewingId !== 'gestor' && (targetConsultant ? targetConsultant.role === 'consultor' : true)
  const scopedLeads = hotLeads.filter((l) => l.consultant_id === viewingId)
  const scopedAppointments = appointments.filter((a) => a.consultant_id === viewingId)
  const selectedAppt = selectedApptId ? appointments.find((a) => a.id === selectedApptId) ?? null : null

  async function handleFile(file: File) {
    setUploading(true)
    setUploadMsg(null)
    try {
      const { leads, skipped } = await parseHotListFile(file)
      if (leads.length === 0) {
        setUploadMsg('Não encontrei nenhuma linha válida — confira se a primeira linha da planilha tem os cabeçalhos (Nome, Telefone, Fonte…).')
      } else {
        const { error, count } = await createHotLeadsBulk(
          leads.map((l) => ({
            consultant_id: viewingId,
            name: toTitleCase(l.name),
            phone: l.phone,
            source: l.source,
            recommended_by: l.recommendedBy ? toTitleCase(l.recommendedBy) : null,
            notes: l.notes,
          })),
        )
        if (error) setUploadMsg(`Não deu pra importar: ${error}`)
        else
          setUploadMsg(
            `✅ ${count} contato${count > 1 ? 's' : ''} adicionado${count > 1 ? 's' : ''} à lista.` +
              (skipped ? ` (${skipped} linha${skipped > 1 ? 's' : ''} sem nome foi ignorada.)` : ''),
          )
      }
    } catch {
      setUploadMsg('Não consegui ler esse arquivo. Confira se é .xlsx (Excel) ou .csv.')
    }
    setUploading(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2.5">
        <div>
          <div className="font-heading font-bold text-[17px]">🔥 Lista HOT</div>
          <div className="text-[12px] text-text-faint">
            Contatos pra abordar — mercado próprio ou indicações — antes de virarem agendamento.
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => downloadCsv('modelo-lista-hot.csv', '﻿' + TEMPLATE_CSV)}
              className="bg-bg border border-[#D8D5CD] rounded-lg px-3 py-2 text-xs font-semibold"
            >
              📥 Baixar modelo
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="bg-bg border border-[#D8D5CD] rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60"
            >
              {uploading ? 'Enviando…' : '📤 Enviar planilha'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="bg-navy text-white border-none rounded-lg px-3 py-2 text-xs font-semibold"
            >
              + Indicação avulsa
            </button>
          </div>
        )}
      </div>

      {uploadMsg && (
        <div className="bg-[#EAF0FA] text-[#0B2D5B] rounded-lg px-3 py-2.5 text-[12.5px] font-semibold">{uploadMsg}</div>
      )}

      {!canManage && (
        <div className="text-[12px] text-text-faint">Selecione um consultor específico no cabeçalho pra ver a lista HOT dele.</div>
      )}

      {canManage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="flex flex-col gap-2.5">
            {scopedLeads.map((lead) => (
              <HotLeadRow
                key={lead.id}
                lead={lead}
                appointments={scopedAppointments}
                onSchedule={() =>
                  setNewApptSlot({
                    consultantIds: [viewingId],
                    date: todayStr(),
                    time: `${String(AGENDA_START_HOUR).padStart(2, '0')}:00`,
                    prefillClientName: lead.name,
                  })
                }
                onRemove={() => {
                  if (confirm(`Remover ${lead.name} da lista HOT?`)) removeHotLead(lead.id)
                }}
              />
            ))}
            {scopedLeads.length === 0 && (
              <div className="text-[12.5px] text-text-faint">
                Nenhum contato na lista ainda. Envie a planilha ou adicione uma indicação avulsa.
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4">
            <DayView
              appointments={scopedAppointments}
              consultants={consultants}
              isGestorView={false}
              viewingId={viewingId}
              apptTypeFilter="todos"
              onOpenAppt={setSelectedApptId}
              onEmptySlotClick={(consultantId, date, time) => setNewApptSlot({ consultantIds: [consultantId], date, time })}
              onConflict={setConflictAppt}
            />
          </div>
        </div>
      )}

      {addOpen && canManage && <NewHotLeadModal consultantId={viewingId} onClose={() => setAddOpen(false)} />}

      {newApptSlot && (
        <NewAppointmentModal
          slot={newApptSlot}
          isGestorAggregate={false}
          prefillClientName={newApptSlot.prefillClientName}
          onClose={() => setNewApptSlot(null)}
        />
      )}

      {selectedAppt && <ClientCardModal appt={selectedAppt} onClose={() => setSelectedApptId(null)} />}

      {conflictAppt && <ConflictAlertModal appt={conflictAppt} onClose={() => setConflictAppt(null)} />}
    </div>
  )
}

function HotLeadRow({
  lead,
  appointments,
  onSchedule,
  onRemove,
}: {
  lead: HotLead
  appointments: Appointment[]
  onSchedule: () => void
  onRemove: () => void
}) {
  const status = hotLeadStatus(lead.name, lead.consultant_id, appointments)
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2.5 flex-wrap mb-2">
        <div>
          <div className="text-[14px] font-semibold">{lead.name}</div>
          <div className="text-[11.5px] text-text-faint">
            {[lead.phone, lead.source === 'recomendacao' ? `🗣️ indicação de ${lead.recommended_by ?? '—'}` : '🛒 mercado próprio']
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <button type="button" onClick={onRemove} className="bg-transparent border-none text-[15px] p-1">
          🗑️
        </button>
      </div>
      {lead.notes && <div className="text-[12px] text-text-muted mb-2.5">{lead.notes}</div>}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: status.bg, color: status.color }}
        >
          {status.icon} {status.label}
        </span>
        <button
          type="button"
          onClick={onSchedule}
          className="bg-navy text-white border-none rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap"
        >
          📅 Agendar
        </button>
      </div>
    </div>
  )
}

function NewHotLeadModal({ consultantId, onClose }: { consultantId: string; onClose: () => void }) {
  const { createHotLead } = useCrm()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState<HotLeadSource>('mercado')
  const [recommendedBy, setRecommendedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await createHotLead({
      consultant_id: consultantId,
      name: toTitleCase(name),
      phone: phone.trim() || null,
      source,
      recommended_by: source === 'recomendacao' && recommendedBy.trim() ? toTitleCase(recommendedBy) : null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} align="center" maxWidth={420}>
      <ModalHeader title="Nova indicação avulsa" onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]" />
        </label>
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Telefone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]" />
        </label>
        <div>
          <div className="text-xs text-text-muted mb-1.5">Fonte</div>
          <div className="flex gap-1.5">
            {(['mercado', 'recomendacao'] as HotLeadSource[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className="flex-1 rounded-lg py-2 text-[13px] font-bold border"
                style={{
                  borderColor: source === s ? '#0B2D5B' : '#D8D5CD',
                  background: source === s ? '#0B2D5B' : '#fff',
                  color: source === s ? '#fff' : '#1A1D23',
                }}
              >
                {s === 'mercado' ? '🛒 Mercado próprio' : '🗣️ Recomendação'}
              </button>
            ))}
          </div>
        </div>
        {source === 'recomendacao' && (
          <label className="text-xs text-text-muted flex flex-col gap-1">
            Quem recomendou
            <input
              value={recommendedBy}
              onChange={(e) => setRecommendedBy(e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
          </label>
        )}
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Outras características importantes (opcional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px] resize-none"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="bg-navy text-white border-none rounded-lg py-2.5 text-[13px] font-bold w-full disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Adicionar à lista'}
        </button>
      </form>
    </Modal>
  )
}
