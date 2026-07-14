import { useCompositedAvatar } from '../hooks/useCompositedAvatar'

type Props = {
  equipped?: Record<string, string> | null
  fallbackLetter: string
  className?: string
}

export function AvatarImage({ equipped, fallbackLetter, className }: Props) {
  const url = useCompositedAvatar(equipped)

  if (url) {
    return <img src={url} alt="" className={className} style={{ imageRendering: 'pixelated' }} />
  }
  return <>{fallbackLetter}</>
}
