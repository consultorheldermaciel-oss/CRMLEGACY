import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { toTitleCase } from '../lib/format'
import { HOT_LEAD_DRAG_TYPE } from '../lib/domain'
import { downloadCsv } from '../lib/report'
import { parseHotListFile } from '../lib/hotListImport'
import { hotLeadStatus } from '../lib/hotListStatus'
import type { Period } from '../lib/kpi'
import type { Appointment, HotLead, HotLeadSource } from '../lib/types'
import { Modal, ModalHeader } from '../components/ui/Modal'
import { AgendaPanel } from '../components/agenda/AgendaPanel'

const TEMPLATE_CSV =
  'Nome;Telefone;Fonte;Recomendado por;Outras características\r\n' +
  'João da Silva;(11) 99999-0000;Mercado;;Trabalha no comércio, mencionou querer proteger a família\r\n' +
  'Maria Souza;(11) 98888-0000;Recomendação;João da Silva;Amiga da Maria, tem dois filhos pequenos\r\n'

const PERIODS: [Period, string][] = [
  ['dia', 'Dia'],
  ['semana', 'Semana'],
  ['mes', 'Mês'],
]

export function HotListPage() {
  const { profile } = useAuth()
  const { consultants, hotLeads, appointments, createHotLeadsBulk, removeHotLead } = useCrm()
  const { viewingId } = useUi()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [period, setPeriod] = useState<Period>('dia')
  const [schedulingLead, setSchedulingLead] = useState<HotLead | null>(null)
  const [expandedLead, setExpandedLead] = useState<HotLead | null>(null)

  if (!profile) return null
  const targetConsultant = consultants.find((c) => c.id === viewingId)
  const canManage = viewingId !== 'gestor' && (targetConsultant ? targetConsultant.role === 'consultor' : true)
  const scopedLeads = hotLeads.filter((l) => l.consultant_id === viewingId)
  const scopedAppointments = appointments.filter((a) => a.consultant_id === viewingId)

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
            Contatos pra abordar — mercado próprio ou recomendações — antes de virarem agendamento.
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
              + Recomendação avulsa
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
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 items-start">
          <div className="flex flex-col gap-2.5">
            {scopedLeads.map((lead) => (
              <HotLeadRow
                key={lead.id}
                lead={lead}
                appointments={scopedAppointments}
                onSchedule={() => setSchedulingLead(lead)}
                onExpand={() => setExpandedLead(lead)}
                onRemove={() => {
                  if (confirm(`Remover ${lead.name} da lista HOT?`)) removeHotLead(lead.id)
                }}
              />
            ))}
            {scopedLeads.length === 0 && (
              <div className="text-[12.5px] text-text-faint">
                Nenhum contato na lista ainda. Envie a planilha ou adicione uma recomendação avulsa.
              </div>
            )}
          </div>

          <div>
            <div className="flex gap-1.5 bg-card border border-border p-1 rounded-[9px] mb-2.5 self-start w-fit">
              {PERIODS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className="rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold"
                  style={{ background: period === key ? '#0B2D5B' : 'transparent', color: period === key ? '#fff' : '#1A1D23' }}
                >
                  {label}
                </button>
              ))}
            </div>
            <AgendaPanel period={period} />
          </div>
        </div>
      )}

      {addOpen && canManage && <NewHotLeadModal consultantId={viewingId} onClose={() => setAddOpen(false)} />}

      {schedulingLead && <HotLeadSchedulerModal lead={schedulingLead} onClose={() => setSchedulingLead(null)} />}

      {expandedLead && (
        <HotLeadDetailModal
          lead={expandedLead}
          appointments={scopedAppointments}
          onSchedule={() => {
            setExpandedLead(null)
            setSchedulingLead(expandedLead)
          }}
          onRemove={() => {
            if (confirm(`Remover ${expandedLead.name} da lista HOT?`)) {
              removeHotLead(expandedLead.id)
              setExpandedLead(null)
            }
          }}
          onClose={() => setExpandedLead(null)}
        />
      )}
    </div>
  )
}

function HotLeadSchedulerModal({ lead, onClose }: { lead: HotLead; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('semana')
  return (
    <Modal onClose={onClose} maxWidth={1180}>
      <ModalHeader title={`Agendar com ${lead.name}`} onClose={onClose} />
      <div className="flex gap-1.5 bg-bg p-1 rounded-lg mb-2.5 w-fit">
        {PERIODS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className="rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold"
            style={{ background: period === key ? '#0B2D5B' : 'transparent', color: period === key ? '#fff' : '#1A1D23' }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="text-[12px] text-text-faint mb-3">
        Clique em um horário livre no calendário pra agendar com {lead.name}.
      </div>
      <AgendaPanel period={period} prefillClientName={lead.name} />
    </Modal>
  )
}

function HotLeadRow({
  lead,
  appointments,
  onSchedule,
  onExpand,
  onRemove,
}: {
  lead: HotLead
  appointments: Appointment[]
  onSchedule: () => void
  onExpand: () => void
  onRemove: () => void
}) {
  const status = hotLeadStatus(lead.name, lead.consultant_id, appointments)
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData(HOT_LEAD_DRAG_TYPE, lead.name)}
      onClick={onExpand}
      className="bg-card border border-border rounded-2xl p-4 cursor-pointer active:cursor-grabbing hover:border-[#0B2D5B]"
      title="Clique pra ver detalhes · arraste até um horário na agenda pra agendar"
    >
      <div className="flex items-start justify-between gap-2.5 flex-wrap mb-2">
        <div>
          <div className="text-[14px] font-semibold">{lead.name}</div>
          <div className="text-[11.5px] text-text-faint">
            {[lead.phone, lead.source === 'recomendacao' ? `recomendação de ${lead.recommended_by ?? '—'}` : '🛒 mercado próprio']
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="bg-transparent border-none text-[15px] p-1"
        >
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
          onClick={(e) => {
            e.stopPropagation()
            onSchedule()
          }}
          className="bg-navy text-white border-none rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap"
        >
          📅 Agendar
        </button>
      </div>
    </div>
  )
}

function HotLeadDetailModal({
  lead,
  appointments,
  onSchedule,
  onRemove,
  onClose,
}: {
  lead: HotLead
  appointments: Appointment[]
  onSchedule: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const status = hotLeadStatus(lead.name, lead.consultant_id, appointments)
  return (
    <Modal onClose={onClose} align="center" maxWidth={460}>
      <ModalHeader title="Detalhes do contato" onClose={onClose} />
      <div className="text-2xl font-heading font-bold mb-2.5">{lead.name}</div>
      <span
        className="inline-block text-[12px] font-bold px-3 py-1.5 rounded-full mb-4"
        style={{ background: status.bg, color: status.color }}
      >
        {status.icon} {status.label}
      </span>

      {lead.phone && (
        <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="block text-xl font-bold text-[#0B2D5B] mb-3.5">
          📞 {lead.phone}
        </a>
      )}

      <div className="text-[14px] font-semibold mb-3.5">
        {lead.source === 'recomendacao' ? `Recomendação de ${lead.recommended_by ?? '—'}` : '🛒 Mercado próprio'}
      </div>

      {lead.notes && (
        <div className="bg-bg rounded-xl p-3.5 text-[14px] leading-relaxed mb-4">{lead.notes}</div>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onRemove}
          className="bg-[#FBE7E7] text-[#B23030] border-none rounded-lg px-3.5 py-3 text-[13px] font-bold"
        >
          🗑️ Remover
        </button>
        <button
          type="button"
          onClick={onSchedule}
          className="flex-1 bg-navy text-white border-none rounded-lg py-3 text-[14px] font-bold"
        >
          📅 Agendar
        </button>
      </div>
    </Modal>
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
      <ModalHeader title="Nova recomendação avulsa" onClose={onClose} />
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
                {s === 'mercado' ? '🛒 Mercado próprio' : 'Recomendação'}
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
