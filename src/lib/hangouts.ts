import { supabase } from './supabase'
import { slugify } from './slug'

export type MyRoom = { id: string; slug: string; name: string }

export async function createHangout(ownerId: string, ownerUsername: string): Promise<MyRoom> {
  const slug = slugify(`${ownerUsername}-hangout`)
  const { data, error } = await supabase
    .from('rooms')
    .insert({ slug, name: `${ownerUsername}'s Hangout`, owner_id: ownerId })
    .select('id, slug, name')
    .single()
  if (error) throw error
  return data
}

export async function getMyActiveRoom(userId: string): Promise<MyRoom | null> {
  const { data } = await supabase
    .from('rooms')
    .select('id, slug, name')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data
}

export async function inviteFriendToRoom(roomId: string, friendId: string) {
  const { error } = await supabase.rpc('invite_friend_to_room', { p_room: roomId, p_friend: friendId })
  if (error) throw error
}

export async function getInvitedFriendIds(roomId: string): Promise<Set<string>> {
  const { data } = await supabase.from('room_invites').select('invited_user_id').eq('room_id', roomId)
  return new Set((data ?? []).map((r) => r.invited_user_id as string))
}

export type HangoutInvite = {
  roomId: string
  roomSlug: string
  roomName: string
  inviterUsername: string
}

export async function listMyHangoutInvites(userId: string): Promise<HangoutInvite[]> {
  const { data: invites } = await supabase
    .from('room_invites')
    .select('room_id, invited_by')
    .eq('invited_user_id', userId)
  if (!invites || invites.length === 0) return []

  const roomIds = [...new Set(invites.map((i) => i.room_id))]
  const inviterIds = [...new Set(invites.map((i) => i.invited_by))]

  const [{ data: rooms }, { data: inviters }] = await Promise.all([
    supabase.from('rooms').select('id, slug, name').in('id', roomIds).eq('is_active', true),
    supabase.from('profiles').select('id, username').in('id', inviterIds),
  ])

  const roomsById = new Map((rooms ?? []).map((r) => [r.id, r]))
  const invitersById = new Map((inviters ?? []).map((p) => [p.id, p.username]))

  return invites
    .map((i) => {
      const room = roomsById.get(i.room_id)
      if (!room) return null
      return {
        roomId: i.room_id,
        roomSlug: room.slug,
        roomName: room.name,
        inviterUsername: invitersById.get(i.invited_by) ?? '?',
      }
    })
    .filter((i): i is HangoutInvite => i !== null)
}
