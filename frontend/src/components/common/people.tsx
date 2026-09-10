/*
 * People. No uploads: an avatar is initials on a hue carried by the profile,
 * so a member is recognisable without anyone having to set a picture.
 */

import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

export const initialsFor = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || '?'

/** The hue is the member's own; lightness and chroma stay fixed so contrast holds. */
const hueStyle = (hue: number) => ({
  backgroundColor: `oklch(0.32 0.07 ${hue})`,
  color: `oklch(0.93 0.06 ${hue})`,
  borderColor: `oklch(0.46 0.09 ${hue})`,
})

export function MemberAvatar({
  profile,
  size = 32,
  className,
}: {
  profile: Profile
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-sans font-medium',
        className,
      )}
      style={{ ...hueStyle(profile.avatarHue), width: size, height: size, fontSize: size * 0.38 }}
      title={profile.displayName}
    >
      <span aria-hidden="true">{initialsFor(profile.displayName)}</span>
      <span className="sr-only">{profile.displayName}</span>
    </span>
  )
}

export function AvatarStack({
  profiles,
  max = 5,
  size = 30,
  className,
}: {
  profiles: Profile[]
  max?: number
  size?: number
  className?: string
}) {
  const shown = profiles.slice(0, max)
  const overflow = profiles.length - shown.length

  return (
    <span className={cn('flex items-center', className)}>
      {/*
        Overlap stays shallow: initials are two characters, and a deeper stack
        hides the second one behind the next avatar.
      */}
      {shown.map((profile, index) => (
        <span
          key={profile.id}
          className="rounded-full ring-2 ring-[var(--panel)]"
          style={{ marginLeft: index === 0 ? 0 : -size * 0.16 }}
        >
          <MemberAvatar profile={profile} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="placard inline-flex shrink-0 items-center justify-center rounded-full border border-bezel-edge bg-face ring-2 ring-[var(--panel)]"
          style={{ width: size, height: size, marginLeft: -size * 0.16, fontSize: size * 0.32 }}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  )
}
