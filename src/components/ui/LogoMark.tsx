import logoIcon from '../../assets/logo-icon.png'

export function LogoMark({ size = 20 }: { size?: number }) {
  return <img src={logoIcon} alt="Legacy" width={size} height={size} style={{ width: size, height: size }} />
}
