export function Chip({
  label,
  active,
  onClick,
  activeColor = '#0B2D5B',
}: {
  label: string
  active: boolean
  onClick: () => void
  activeColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold border transition-colors"
      style={{
        borderColor: active ? activeColor : '#D8D5CD',
        background: active ? activeColor : '#fff',
        color: active ? '#fff' : '#1A1D23',
      }}
    >
      {label}
    </button>
  )
}
