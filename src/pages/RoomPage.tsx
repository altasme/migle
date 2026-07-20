import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchLiveKitToken, kickFromLiveKit, LIVEKIT_URL } from '../lib/livekit'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { SafetyMenu } from '../components/SafetyMenu'
import { FriendInviteList } from '../components/FriendInviteList'
import { listFriends, type Friend } from '../lib/friends'
import { getInvitedFriendIds, inviteFriendToRoom } from '../lib/hangouts'

type GiftCatalogItem = {
  id: string
  name: string
  price_coins: number | null
}

type Supporter = {
  user_id: string
  username: string
  total: number
  rank: number
}

type GiftAnimPayload = {
  giftId: string
  giftName: string
  senderName: string
  recipientName: string
}

const GIFT_EMOJI: Record<string, string> = {
  rose: '🌹',
  coffee: '☕',
  cake: '🎂',
  teddy: '🧸',
  balloons: '🎈',
  fireworks: '🎆',
  ring: '💍',
}

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
  equipped: Record<string, string>
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
  profiles: { username: string; equipped: Record<string, string> } | null
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

  const [giftCatalog, setGiftCatalog] = useState<GiftCatalogItem[]>([])
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [giftTab, setGiftTab] = useState<'gifts' | 'rings'>('gifts')
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null)
  const [sendingGift, setSendingGift] = useState(false)
  const [giftSendError, setGiftSendError] = useState<string | null>(null)
  const [activeGiftAnim, setActiveGiftAnim] = useState<GiftAnimPayload | null>(null)
  const [ejected, setEjected] = useState(false)
  const [joinDenied, setJoinDenied] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [nowPlaying, setNowPlaying] = useState<{ title: string; djUsername: string; paused: boolean } | null>(
    null,
  )
  const [musicStatus, setMusicStatus] = useState<'idle' | 'starting' | 'playing' | 'error'>('idle')
  const [musicError, setMusicError] = useState<string | null>(null)
  const [musicPaused, setMusicPaused] = useState(false)
  const [musicVolume, setMusicVolume] = useState(1)

  const livekitRoomRef = useRef<Room | null>(null)
  const audioContainerRef = useRef<HTMLDivElement | null>(null)
  const membersRef = useRef<Member[]>([])
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const hasJoinedRef = useRef(false)
  const musicAudioElRef = useRef<HTMLAudioElement | null>(null)
  const musicTrackRef = useRef<MediaStreamTrack | null>(null)
  const musicObjectUrlRef = useRef<string | null>(null)
  const musicFileInputRef = useRef<HTMLInputElement | null>(null)

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
      .select('user_id, seat_index, is_muted, profiles(username, equipped)')
      .eq('room_id', rid)
    const rows = (data ?? []) as unknown as RoomMemberRow[]
    setMembers(
      rows.map((r) => ({
        user_id: r.user_id,
        seat_index: r.seat_index,
        is_muted: r.is_muted,
        username: r.profiles?.username ?? '?',
        equipped: r.profiles?.equipped ?? {},
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

  async function loadSupporters(rid: string) {
    const { data } = await supabase
      .from('room_supporters')
      .select('user_id, total, rank')
      .eq('room_id', rid)
      .order('rank', { ascending: true })
      .limit(5)
    const rows = data ?? []
    if (rows.length === 0) {
      setSupporters([])
      return
    }
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', rows.map((r) => r.user_id))
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.username]))
    setSupporters(rows.map((r) => ({ ...r, username: nameMap.get(r.user_id) ?? '?' })))
  }

  function showGiftAnimation(payload: GiftAnimPayload) {
    setActiveGiftAnim(payload)
    setTimeout(() => {
      setActiveGiftAnim((cur) => (cur === payload ? null : cur))
    }, 3000)
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
      const { error: joinError } = await supabase
        .from('room_members')
        .insert({ room_id: roomId, user_id: userId })
      if (joinError && joinError.code !== '23505') {
        // Not a "already joined" conflict — most likely RLS rejected us
        // because this hangout is invite-only and we're not on the list.
        if (!active) return
        setJoinDenied(true)
        return
      }
      if (!active) return
      await Promise.all([loadMembers(roomId!), loadMessages(roomId!), loadSupporters(roomId!)])
      if (!active) return
      hasJoinedRef.current = true
      await connectVoice(slug!)
    }
    setup()

    // Belt-and-suspenders: don't rely solely on the realtime push to
    // notice an owner mute/kick — poll the roster too.
    const memberPollId = setInterval(() => loadMembers(roomId!), 5000)

    supabase
      .from('gift_catalog')
      .select('id, name, price_coins')
      .then(({ data }) => setGiftCatalog(data ?? []))

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
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, username }]))
        },
      )
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        showGiftAnimation(payload as GiftAnimPayload)
        loadSupporters(roomId!)
      })
      .on('broadcast', { event: 'music' }, ({ payload }) => {
        const p = payload as {
          action: 'play' | 'stop' | 'pause_state'
          title?: string
          djUsername?: string
          paused?: boolean
        }
        if (p.action === 'stop') {
          setNowPlaying(null)
        } else if (p.action === 'play' && p.title) {
          setNowPlaying({ title: p.title, djUsername: p.djUsername ?? '?', paused: false })
        } else if (p.action === 'pause_state') {
          setNowPlaying((cur) => (cur ? { ...cur, paused: !!p.paused } : cur))
        }
      })
      .subscribe((status, err) => {
        console.log('[realtime] channel status:', status, err ?? '')
      })
    channelRef.current = channel

    return () => {
      active = false
      clearInterval(memberPollId)
      channelRef.current = null
      supabase.removeChannel(channel)
      livekitRoomRef.current?.disconnect()
      livekitRoomRef.current = null
      stopMusicLocal()
    }
  }, [roomId, userId, slug])

  const me = members.find((m) => m.user_id === userId)

  // Owner kicked us: we joined successfully at some point but no longer
  // appear on the roster. Disconnect and bounce home.
  useEffect(() => {
    if (!hasJoinedRef.current || !userId) return
    if (!me) {
      setEjected(true)
      livekitRoomRef.current?.disconnect()
      const t = setTimeout(() => navigate('/'), 2500)
      return () => clearTimeout(t)
    }
  }, [members, userId, me, navigate])

  // Owner force-muted us: our token already grants publish, so the DB
  // flag alone won't stop us — sync the local mic to match.
  useEffect(() => {
    if (!me) return
    livekitRoomRef.current?.localParticipant.setMicrophoneEnabled(!me.is_muted)
  }, [me?.is_muted])
  const mySeat = me?.seat_index ?? null
  const myMuted = me?.is_muted ?? false
  const isOwner = room !== null && room !== 'not-found' && room.owner_id === userId

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
    // Don't wait on the realtime round-trip for our own action — refresh now.
    await loadMembers(roomId)
    await connectVoice(slug)
  }

  async function leaveSeat() {
    if (!roomId || !userId || !slug) return
    await supabase
      .from('room_members')
      .update({ seat_index: null, is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId)
    await loadMembers(roomId)
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
    await loadMembers(roomId)
    await livekitRoomRef.current?.localParticipant.setMicrophoneEnabled(!next)
  }

  async function ownerMute(targetUserId: string, muted: boolean) {
    if (!roomId) return
    await supabase.rpc('owner_mute_member', { p_room: roomId, p_user: targetUserId, p_muted: muted })
    await loadMembers(roomId)
  }

  async function ownerKick(targetUserId: string) {
    if (!roomId) return
    await supabase.rpc('owner_kick_member', { p_room: roomId, p_user: targetUserId })
    await loadMembers(roomId)
    // Hard-enforce it server-side too — don't rely solely on the kicked
    // user's own client noticing the DB change and self-disconnecting.
    try {
      await kickFromLiveKit(roomId, targetUserId)
    } catch (err) {
      console.error('LiveKit kick failed:', err)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId || !userId || !chatInput.trim()) return
    const body = chatInput.trim()
    setChatInput('')
    const { data, error } = await supabase
      .from('room_messages')
      .insert({ room_id: roomId, user_id: userId, body })
      .select('id, created_at')
      .single()
    if (error || !data) return
    // Append immediately rather than waiting on the realtime echo — the
    // postgres_changes handler dedupes by id if it also delivers this row.
    setMessages((prev) =>
      prev.some((m) => m.id === data.id)
        ? prev
        : [...prev, { id: data.id, user_id: userId, username: me?.username ?? '?', body, created_at: data.created_at }],
    )
  }

  async function sendGift(giftId: string) {
    if (!roomId || !userId || !giftRecipientId) return
    setSendingGift(true)
    setGiftSendError(null)
    const { error } = await supabase.rpc('send_gift', {
      p_gift_id: giftId,
      p_to: giftRecipientId,
      p_room: roomId,
    })
    setSendingGift(false)
    if (error) {
      setGiftSendError(error.message.includes('coins') ? 'Not enough coins.' : error.message)
      return
    }
    setGiftModalOpen(false)
    setGiftRecipientId(null)
    const gift = giftCatalog.find((g) => g.id === giftId)
    const recipient = members.find((m) => m.user_id === giftRecipientId)
    const payload: GiftAnimPayload = {
      giftId,
      giftName: gift?.name ?? giftId,
      senderName: me?.username ?? '?',
      recipientName: recipient?.username ?? '?',
    }
    channelRef.current?.send({ type: 'broadcast', event: 'gift', payload })
    showGiftAnimation(payload)
    await loadSupporters(roomId)
  }

  async function leaveRoom() {
    stopMusicLocal()
    if (roomId && userId) {
      await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId)
    }
    livekitRoomRef.current?.disconnect()
    navigate('/')
  }

  // Cleanup only - no broadcast. Used on unmount/leave, where there's no
  // point telling everyone else "stopped" since we're already gone and
  // the track disappearing does that implicitly.
  function stopMusicLocal() {
    const track = musicTrackRef.current
    if (track && livekitRoomRef.current) {
      livekitRoomRef.current.localParticipant.unpublishTrack(track)
    }
    track?.stop()
    musicTrackRef.current = null
    if (musicAudioElRef.current) {
      musicAudioElRef.current.pause()
      musicAudioElRef.current.src = ''
    }
    if (musicObjectUrlRef.current) {
      URL.revokeObjectURL(musicObjectUrlRef.current)
      musicObjectUrlRef.current = null
    }
    setMusicStatus('idle')
    setMusicPaused(false)
  }

  // Web apps can't read a phone's actual song library - there's no
  // browser API for that. This is the closest real equivalent: pick a
  // file each time via the native picker, then capture its audio output
  // and publish it as an extra LiveKit track. Everyone else's existing
  // TrackSubscribed handler picks it up automatically, same as any other
  // audio track - no changes needed on the listening side.
  async function handleMusicFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !roomId || !me) return

    // Publishing anything requires a mic seat - canPublish is granted
    // server-side based on seat status (Rule 4), there's no separate
    // grant tier for "just music". Same requirement, clearer error than
    // letting LiveKit's own rejection surface as a raw message.
    if (mySeat === null) {
      setMusicStatus('error')
      setMusicError('Take a mic seat first, then you can play music.')
      return
    }

    const audioEl = musicAudioElRef.current
    const lkRoom = livekitRoomRef.current
    if (!audioEl || !lkRoom) return

    type CaptureCapable = HTMLAudioElement & {
      captureStream?: () => MediaStream
      mozCaptureStream?: () => MediaStream
    }
    const capable = audioEl as CaptureCapable
    const captureFn = capable.captureStream ?? capable.mozCaptureStream
    if (!captureFn) {
      setMusicStatus('error')
      setMusicError("Music streaming isn't supported on this browser.")
      return
    }

    setMusicStatus('starting')
    setMusicError(null)
    try {
      stopMusicLocal()
      const url = URL.createObjectURL(file)
      musicObjectUrlRef.current = url
      audioEl.src = url
      audioEl.loop = true
      audioEl.volume = musicVolume
      await audioEl.play()

      const stream = captureFn.call(audioEl)
      const [track] = stream.getAudioTracks()
      if (!track) throw new Error('No audio track captured')
      musicTrackRef.current = track

      await lkRoom.localParticipant.publishTrack(track, { name: 'music' })
      setMusicStatus('playing')
      setMusicPaused(false)
      // Realtime broadcast doesn't echo back to the sender by default -
      // update our own copy directly, same pattern sendGift() already
      // uses for its animation instead of waiting on self-receipt.
      setNowPlaying({ title: file.name, djUsername: me.username, paused: false })

      channelRef.current?.send({
        type: 'broadcast',
        event: 'music',
        payload: { action: 'play', title: file.name, djUsername: me.username },
      })
    } catch (err) {
      setMusicStatus('error')
      setMusicError(err instanceof Error ? err.message : 'Failed to play music')
    }
  }

  function handleStopMusic() {
    stopMusicLocal()
    setNowPlaying(null)
    channelRef.current?.send({ type: 'broadcast', event: 'music', payload: { action: 'stop' } })
  }

  function toggleMusicPause() {
    const audioEl = musicAudioElRef.current
    if (!audioEl) return
    const nowPaused = !audioEl.paused
    if (nowPaused) audioEl.pause()
    else audioEl.play()
    setMusicPaused(nowPaused)
    setNowPlaying((cur) => (cur ? { ...cur, paused: nowPaused } : cur))
    channelRef.current?.send({
      type: 'broadcast',
      event: 'music',
      payload: { action: 'pause_state', paused: nowPaused },
    })
  }

  function handleMusicVolumeChange(v: number) {
    setMusicVolume(v)
    if (musicAudioElRef.current) musicAudioElRef.current.volume = v
  }

  async function openInvitePanel() {
    if (!roomId || !userId) return
    setInviteModalOpen(true)
    setInviteError(null)
    const [f, invited] = await Promise.all([listFriends(userId), getInvitedFriendIds(roomId)])
    setFriends(f)
    setInvitedIds(invited)
  }

  async function handleInviteFriend(friendId: string) {
    if (!roomId) return
    setInvitingId(friendId)
    setInviteError(null)
    try {
      await inviteFriendToRoom(roomId, friendId)
      setInvitedIds((prev) => new Set(prev).add(friendId))
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setInvitingId(null)
    }
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
  if (joinDenied) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">This hangout is invite-only, and you haven't been invited.</p>
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
      <audio ref={musicAudioElRef} className="hidden" />
      <input
        ref={musicFileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleMusicFileChange}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{room.name}</h1>
          <p className="text-xs text-zinc-500">/r/{room.slug}</p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <button
              onClick={openInvitePanel}
              className="rounded-lg border border-purple-600 px-3 py-1.5 text-sm font-medium text-purple-400"
            >
              👥 Invite
            </button>
          )}
          {isOwner && musicStatus !== 'playing' && musicStatus !== 'starting' && (
            <button
              onClick={() => musicFileInputRef.current?.click()}
              className="rounded-lg border border-purple-600 px-3 py-1.5 text-sm font-medium text-purple-400"
            >
              🎵 Play music
            </button>
          )}
          <button
            onClick={() => setGiftModalOpen(true)}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            🎁 Gift
          </button>
          <button
            onClick={leaveRoom}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
          >
            Leave
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Voice: {voiceStatus}
        {voiceError ? `: ${voiceError}` : ''}
      </p>

      {musicError && <p className="text-xs text-red-400">{musicError}</p>}

      {nowPlaying && (
        <div className="flex flex-col gap-2 rounded-lg border border-purple-800/50 bg-purple-950/30 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span>🎵</span>
            <span className="flex-1 text-zinc-200">
              <span className="font-medium text-white">{nowPlaying.title}</span> · played by{' '}
              {nowPlaying.djUsername}
              {nowPlaying.paused && <span className="text-zinc-500"> · paused</span>}
            </span>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMusicPause}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
              >
                {musicPaused ? '▶ Play' : '⏸ Pause'}
              </button>
              <button
                onClick={() => musicFileInputRef.current?.click()}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
              >
                ⏭ Next track
              </button>
              <button
                onClick={handleStopMusic}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
              >
                ⏹ Stop
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={musicVolume}
                onChange={(e) => handleMusicVolumeChange(Number(e.target.value))}
                className="flex-1"
                aria-label="Music volume"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: room.max_seats }, (_, i) => {
          const occupant = members.find((m) => m.seat_index === i)
          const isMe = occupant?.user_id === userId
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="relative">
                <button
                  onClick={() => (occupant ? (isMe ? toggleMute() : undefined) : takeSeat(i))}
                  disabled={!occupant && mySeat === i}
                  className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 text-white ${
                    occupant
                      ? isMe
                        ? 'border-purple-500 bg-purple-900'
                        : 'border-zinc-600 bg-zinc-800'
                      : 'border-dashed border-zinc-700 bg-zinc-900 text-zinc-600'
                  }`}
                >
                  {occupant ? (
                    <AvatarImage
                      equipped={occupant.equipped}
                      fallbackLetter={occupant.username[0]?.toUpperCase() ?? '?'}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    '+'
                  )}
                </button>
                {occupant && !isMe && (
                  <div className="absolute -right-1 -top-1 rounded-full bg-zinc-900/90">
                    <SafetyMenu
                      targetId={occupant.user_id}
                      targetUsername={occupant.username}
                      roomId={roomId ?? undefined}
                      ownerControls={
                        isOwner
                          ? {
                              isMuted: occupant.is_muted,
                              onMute: (muted) => ownerMute(occupant.user_id, muted),
                              onKick: () => ownerKick(occupant.user_id),
                            }
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
              <span className="max-w-14 truncate text-xs text-zinc-400">
                {occupant ? occupant.username : 'empty'}
                {occupant?.is_muted ? ' 🔇' : ''}
              </span>
            </div>
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
            <span
              key={l.user_id}
              className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1"
            >
              {l.username}
              {l.user_id !== userId && (
                <SafetyMenu
                  targetId={l.user_id}
                  targetUsername={l.username}
                  roomId={roomId ?? undefined}
                  ownerControls={
                    isOwner
                      ? {
                          isMuted: l.is_muted,
                          onMute: (muted) => ownerMute(l.user_id, muted),
                          onKick: () => ownerKick(l.user_id),
                        }
                      : undefined
                  }
                />
              )}
            </span>
          ))}
        </div>
      )}

      {supporters.length > 0 && (
        <div className="rounded-lg border border-zinc-800 p-3">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Top supporters (24h)
          </h2>
          <div className="flex flex-col gap-1">
            {supporters.map((s) => (
              <div key={s.user_id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">
                  #{s.rank} {s.username}
                </span>
                <span className="text-yellow-400">🪙 {s.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inviteModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-xs rounded-2xl bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Invite friends</p>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {inviteError && <p className="mb-2 text-xs text-red-400">{inviteError}</p>}
            <FriendInviteList
              friends={friends}
              invitedIds={invitedIds}
              invitingId={invitingId}
              onInvite={handleInviteFriend}
            />
          </div>
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

      {giftModalOpen && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-sm rounded-t-2xl bg-zinc-900 p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Send a gift</h2>
              <button
                onClick={() => {
                  setGiftModalOpen(false)
                  setGiftRecipientId(null)
                  setGiftSendError(null)
                }}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="mb-1 text-xs font-medium text-zinc-500">To</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {members
                .filter((m) => m.user_id !== userId)
                .map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => setGiftRecipientId(m.user_id)}
                    className={`rounded-full border-2 px-3 py-1 text-sm ${
                      giftRecipientId === m.user_id
                        ? 'border-purple-500 text-white'
                        : 'border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {m.username}
                  </button>
                ))}
              {members.filter((m) => m.user_id !== userId).length === 0 && (
                <p className="text-sm text-zinc-500">No one else is here yet.</p>
              )}
            </div>

            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setGiftTab('gifts')}
                className={`flex-1 rounded-lg border-2 py-1.5 text-sm font-medium ${
                  giftTab === 'gifts'
                    ? 'border-purple-500 text-white'
                    : 'border-zinc-800 text-zinc-500'
                }`}
              >
                🎁 Gifts
              </button>
              <button
                onClick={() => setGiftTab('rings')}
                className={`flex-1 rounded-lg border-2 py-1.5 text-sm font-medium ${
                  giftTab === 'rings'
                    ? 'border-pink-500 text-white'
                    : 'border-zinc-800 text-zinc-500'
                }`}
              >
                💍 Rings
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {giftCatalog
                .filter((g) => (giftTab === 'rings' ? g.id === 'ring' : g.id !== 'ring'))
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => sendGift(g.id)}
                    disabled={!giftRecipientId || sendingGift}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 disabled:opacity-40 ${
                      giftTab === 'rings'
                        ? 'border-pink-800 bg-pink-950/30'
                        : 'border-zinc-800'
                    }`}
                  >
                    <span className="text-2xl">{GIFT_EMOJI[g.id] ?? (giftTab === 'rings' ? '💍' : '🎁')}</span>
                    <span className={`text-xs ${giftTab === 'rings' ? 'text-pink-200' : 'text-zinc-300'}`}>
                      {g.name}
                    </span>
                    <span className="text-xs text-yellow-400">🪙 {g.price_coins}</span>
                  </button>
                ))}
            </div>

            {giftSendError && <p className="mt-3 text-sm text-red-400">{giftSendError}</p>}
          </div>
        </div>
      )}

      {activeGiftAnim && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center bg-black/40">
          <p className="animate-bounce text-8xl">{GIFT_EMOJI[activeGiftAnim.giftId] ?? '🎁'}</p>
          <p className="mt-4 text-lg font-semibold text-white">
            {activeGiftAnim.senderName} sent {activeGiftAnim.recipientName} a {activeGiftAnim.giftName}!
          </p>
        </div>
      )}

      {ejected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80">
          <p className="text-center text-white">
            You were removed from this room by the owner.
          </p>
        </div>
      )}
    </div>
  )
}
