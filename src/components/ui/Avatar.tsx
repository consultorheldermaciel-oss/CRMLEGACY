import { initials } from '../../lib/format'
import type { Profile } from '../../lib/types'

export function Avatar({ profile, size }: { profile: Pick<Profile, 'name' | 'color' | 'avatar_url'>; size: number }) {
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: profile.color, fontSize: size * 0.35 }}
    >
      {initials(profile.name)}
    </div>
  )
}
