import { useCompositedAvatar } from '../hooks/useCompositedAvatar'

type Props = {
  equipped?: Record<string, string> | null
  fallbackLetter: string
  className?: string
  // Cosmetic sprites are framed full-body with no separate bust art, so
  // 'bust' is a CSS zoom/crop (scale + top-anchored origin) rather than a
  // different composite - an approximation, not a true headshot render.
  // Callers where the full outfit actually matters (Wardrobe) opt into 'full'.
  variant?: 'full' | 'bust'
}

export function AvatarImage({ equipped, fallbackLetter, className, variant = 'bust' }: Props) {
  const url = useCompositedAvatar(equipped)

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={className}
        style={
          variant === 'bust'
            ? { imageRendering: 'pixelated', transform: 'scale(2)', transformOrigin: '50% 0%' }
            : { imageRendering: 'pixelated' }
        }
      />
    )
  }
  return <>{fallbackLetter}</>
}
