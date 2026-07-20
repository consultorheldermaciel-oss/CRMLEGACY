import type { ReactNode } from 'react'

export function Modal({
  onClose,
  children,
  maxWidth = 640,
  align = 'start',
}: {
  onClose: () => void
  children: ReactNode
  maxWidth?: number
  align?: 'start' | 'center'
}) {
  return (
    <div
      className={`fixed inset-0 bg-[rgba(10,15,25,0.5)] flex justify-center overflow-y-auto z-50 px-4 ${
        align === 'center' ? 'items-center py-4' : 'items-start py-10'
      }`}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full p-6"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="font-heading font-bold text-lg">{title}</div>
      <button
        type="button"
        onClick={onClose}
        className="bg-transparent border-none text-2xl text-text-faint leading-none"
      >
        ×
      </button>
    </div>
  )
}
