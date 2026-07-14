import { supabase } from './supabase'

export async function fetchLiveKitToken(roomSlug: string) {
  const { data, error } = await supabase.functions.invoke<{
    token: string
    canPublish: boolean
  }>('livekit-token', { body: { roomSlug } })

  if (error) throw error
  if (!data) throw new Error('No token returned')
  return data
}

export const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string | undefined

export async function kickFromLiveKit(roomId: string, targetUserId: string) {
  const { error } = await supabase.functions.invoke('livekit-kick', {
    body: { roomId, targetUserId },
  })
  if (error) throw error
}
