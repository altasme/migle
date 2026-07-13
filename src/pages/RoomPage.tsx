import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import { supabase } from '../lib/supabase'
import { fetchLiveKitToken, LIVEKIT_URL } from '../lib/livekit'
import { useAuthStore } from '../store/authStore'

type RoomRow = {
  id: string
  slug: string
  name: string
  max_seats: number
  owner_id: string
}

type Member = {
  user_id: string
  seat_index: number | null
  is_muted: boolean
  username: string
}

type ChatMessage = {
  id: number
  user_id: string
  username: string
  body: string
  created_at: string
}

type RoomMemberRow = {
  user_id: string
  seat_index: number | null
  is_muted: boolean
  profiles: { username: string } | null
}

type RoomMessageRow = {
  id: number
  user_id: string
  body: string
  created_at: string
  profiles: { username: string } | null
}

export function RoomPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)

  const [room, setRoom] = useState<RoomRow | 'not-found' | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>(
    'idle',
  )
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [seatError, setSeatError] = useState<string | null>(null)

  const livekitRoomRef = useRef<Room | null>(null)
  const audioContainerRef = useRef<HTMLDivElement | null>(null)
  const membersRef = useRef<Member[]>([])
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    membersRef.current = members
  }, [members])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  // Load the room by slug.
  useEffect(() => {
    if (!slug) return
    setRoom(null)
    supabase
      .from('rooms')
      .select('id, slug, name, max_seats, owner_id')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => setRoom(data ?? 'not-found'))
  }, [slug])

  const roomId = room && room !== 'not-found' ? room.id : null

  async function loadMembers(rid: string) {
    const { data } = await supabase
      .from('room_members')
      .select('user_id, seat_index, is_muted, profiles(username)')
      .eq('room_id', rid)
    const rows = (data ?? []) as unknown as RoomMemberRow[]
    setMembers(
      rows.map((r) => ({
        user_id: r.user_id,
        seat_index: r.seat_index,
        is_muted: r.is_muted,
        username: r.profiles?.username ?? '?',
      })),
    )
  }

  async function loadMessages(rid: string) {
    const { data } = await supabase
      .from('room_messages')
      .select('id, user_id, body, created_at, profiles(username)')
      .eq('room_id', rid)
      .order('created_at', { ascending: false })
      .limit(50)
    const rows = (data ?? []) as unknown as RoomMessageRow[]
    setMessages(
      rows
        .reverse()
        .map((r) => ({
          id: r.id,
          user_id: r.user_id,
          body: r.body,
          created_at: r.created_at,
          username: r.profiles?.username ?? '?',
        })),
    )
  }

  async function connectVoice(roomSlug: string) {
    if (!LIVEKIT_URL) {
      setVoiceStatus('error')
      setVoiceError('VITE_LIVEKIT_URL is not set')
      return
    }
    setVoiceStatus('connecting')
    setVoiceError(null)
    try {
      if (livekitRoomRef.current) {
        await livekitRoomRef.current.disconnect()
        livekitRoomRef.current = null
      }
      const { token, canPublish } = await fetchLiveKitToken(roomSlug)
      const lkRoom = new Room()
      lkRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.autoplay = true
          audioContainerRef.current?.appendChild(el)
        }
      })
      lkRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove())
      })
      livekitRoomRef.current = lkRoom
      await lkRoom.connect(LIVEKIT_URL, token)
      if (canPublish) {
        await lkRoom.localParticipant.setMicrophoneEnabled(true)
      }
      setVoiceStatus('connected')
    } catch (err) {
      setVoiceStatus('error')
      setVoiceError(err instanceof Error ? err.message : 'Failed to connect voice')
    }
  }

  // Join as a member, load state, connect voice, subscribe to realtime.
  useEffect(() => {
    if (!roomId || !userId || !slug) return

    let active = true

    async function setup() {
      await supabase
        .from('room_members')
        .insert({ room_id: roomId, user_id: userId })
        .then(({ error }) => {
          if (error && error.code !== '23505') console.error(error)
        })
      if (!active) return
      await Promise.all([loadMembers(roomId!), loadMessages(roomId!)])
      if (!active) return
      await connectVoice(slug!)
    }
    setup()

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
        () => loadMembers(roomId!),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { id: number; user_id: string; body: string; created_at: string }
          const username = membersRef.current.find((m) => m.user_id === row.user_id)?.username ?? '?'
          setMessages((prev) => [...prev, { ...row, username }])
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
      livekitRoomRef.current?.disconnect()
      livekitRoomRef.current = null
    }
  }, [roomId, userId, slug])

  const me = members.find((m) => m.user_id === userId)
  const mySeat = me?.seat_index ?? null
  const myMuted = me?.is_muted ?? false

  async function takeSeat(index: number) {
    if (!roomId || !userId || !slug) return
    setSeatError(null)
    const { error } = await supabase
      .from('room_members')
      .update({ seat_index: index, is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId)
    if (error) {
      setSeatError(error.code === '23505' ? 'That seat was just taken.' : error.message)
      return
    }
    await connectVoice(slug)
  }

  async function leaveSeat() {
    if (!roomId || !userId || !slug) return
    await supabase
      .from('room_members')
      .update({ seat_index: null, is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId)
    await connectVoice(slug)
  }

  async function toggleMute() {
    if (!roomId || !userId) return
    const next = !myMuted
    await supabase
      .from('room_members')
      .update({ is_muted: next })
      .eq('room_id', roomId)
      .eq('user_id', userId)
    await livekitRoomRef.current?.localParticipant.setMicrophoneEnabled(!next)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId || !userId || !chatInput.trim()) return
    const body = chatInput.trim()
    setChatInput('')
    await supabase.from('room_messages').insert({ room_id: roomId, user_id: userId, body })
  }

  async function leaveRoom() {
    if (roomId && userId) {
      await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId)
    }
    livekitRoomRef.current?.disconnect()
    navigate('/')
  }

  if (room === null) {
    return <p className="p-6 text-center text-zinc-400">Loading…</p>
  }
  if (room === 'not-found') {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Room not found.</p>
        <button onClick={() => navigate('/')} className="mt-2 text-purple-400 hover:underline">
          Back home
        </button>
      </div>
    )
  }

  const listeners = members.filter((m) => m.seat_index === null)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div ref={audioContainerRef} className="hidden" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{room.name}</h1>
          <p className="text-xs text-zinc-500">/r/{room.slug}</p>
        </div>
        <button
          onClick={leaveRoom}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
        >
          Leave
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Voice: {voiceStatus}
        {voiceError ? ` — ${voiceError}` : ''}
      </p>

      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: room.max_seats }, (_, i) => {
          const occupant = members.find((m) => m.seat_index === i)
          const isMe = occupant?.user_id === userId
          return (
            <button
              key={i}
              onClick={() => (occupant ? (isMe ? toggleMute() : undefined) : takeSeat(i))}
              disabled={!occupant && mySeat === i}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-white ${
                  occupant
                    ? isMe
                      ? 'border-purple-500 bg-purple-900'
                      : 'border-zinc-600 bg-zinc-800'
                    : 'border-dashed border-zinc-700 bg-zinc-900 text-zinc-600'
                }`}
              >
                {occupant ? occupant.username[0]?.toUpperCase() : '+'}
              </div>
              <span className="max-w-14 truncate text-xs text-zinc-400">
                {occupant ? occupant.username : 'empty'}
                {occupant?.is_muted ? ' 🔇' : ''}
              </span>
            </button>
          )
        })}
      </div>

      {mySeat !== null && (
        <div className="flex justify-center gap-2">
          <button
            onClick={toggleMute}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
          >
            {myMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={leaveSeat}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
          >
            Leave seat
          </button>
        </div>
      )}
      {seatError && <p className="text-center text-sm text-red-400">{seatError}</p>}

      {listeners.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 text-xs text-zinc-500">
          {listeners.map((l) => (
            <span key={l.user_id} className="rounded-full bg-zinc-900 px-2 py-1">
              {l.username}
            </span>
          ))}
        </div>
      )}

      <div className="flex h-72 flex-col rounded-lg border border-zinc-800">
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {messages.map((m) => (
            <p key={m.id} className="text-sm text-zinc-300">
              <span className="font-medium text-white">{m.username}: </span>
              {m.body}
            </p>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t border-zinc-800 p-2">
          <input
            type="text"
            maxLength={500}
            placeholder="Say something…"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
