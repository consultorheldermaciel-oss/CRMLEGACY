export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22 22H78V78H22V22ZM32 32V68H68V32H32Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50 12L88 50L50 88L12 50L50 12ZM50 26.3L26.3 50L50 73.7L73.7 50L50 26.3Z"
        fill="white"
        fillOpacity="0.9"
      />
    </svg>
  )
}
