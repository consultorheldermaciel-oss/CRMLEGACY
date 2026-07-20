import { useState } from 'react'
import { useCrm } from '../../context/CrmContext'
import { useUi } from '../../context/UiContext'
import { taskUrgency } from '../../lib/domain'
import { Modal } from '../ui/Modal'

export function TaskModal() {
  const { taskModal, closeTaskModal } = useUi()
  const { consultants, createTask } = useCrm()
  const [text, setText] = useState('')
  const [deadline, setDeadline] = useState(taskModal.prefillDeadline)
  const [saving, setSaving] = useState(false)

  if (!taskModal.open || !taskModal.consultantId) return null
  const consultant = consultants.find((c) => c.id === taskModal.consultantId)
  const preview = deadline ? taskUrgency(deadline, new Date()) : null

  async function handleSave() {
    if (!text.trim() || !deadline || !taskModal.consultantId) return
    setSaving(true)
    await createTask({ consultant_id: taskModal.consultantId, text, deadline })
    setSaving(false)
    setText('')
    setDeadline('')
    closeTaskModal()
  }

  return (
    <Modal onClose={closeTaskModal} maxWidth={440}>
      <div className="relative pr-8 mb-3">
        <div className="font-heading font-bold text-[17px] whitespace-nowrap">👉 Alerta Cutucão</div>
        <button
          type="button"
          onClick={closeTaskModal}
          className="absolute -top-0.5 right-0 bg-transparent border-none text-2xl text-text-faint leading-none p-0"
        >
          ×
        </button>
      </div>
      <div className="text-[12.5px] text-text-muted mb-4 leading-relaxed">
        Para {consultant?.name} — atribua uma tarefa e um prazo; quanto mais em cima da hora, mais quente o alerta
        fica.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="O que precisa ser feito? Ex: Ligar para a Marisa e confirmar apólice"
        className="w-full border border-[#D8D5CD] rounded-lg px-3.5 py-2.5 text-[13px] mb-3 min-h-[70px] resize-y"
      />
      <label className="flex flex-col gap-1 text-xs text-text-muted mb-4">
        Prazo
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
        />
      </label>
      {preview && (
        <div
          className="rounded-lg px-3 py-2.5 text-[12.5px] font-bold mb-4"
          style={{ background: preview.bg, color: preview.color }}
        >
          {preview.label}
        </div>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="bg-navy text-white border-none rounded-[10px] py-3 text-sm font-bold w-full disabled:opacity-60"
      >
        {saving ? 'Enviando…' : 'Enviar Cutucão'}
      </button>
    </Modal>
  )
}
