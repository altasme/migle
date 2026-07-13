import { useEffect, useState } from 'react'
import { compositeAvatar, hashEquipped } from '../lib/compositor'

export function useCompositedAvatar(equipped: Record<string, string> | null | undefined) {
  const ids = equipped ? Object.values(equipped).filter(Boolean) : []
  const key = hashEquipped(ids)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (ids.length === 0) {
      setUrl(null)
      return
    }
    let cancelled = false
    compositeAvatar(ids).then((dataUrl) => {
      if (!cancelled) setUrl(dataUrl)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return url
}
