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
import { getInvitedFriendIds, inviteFriendToRoom, updateHangout } from '../lib/hangouts'
import { ROOM_THEMES, getRoomThemeGradient, type RoomThemeId } from '../lib/roomThemes'
import { searchJamendoTracks, fetchJamendoByTag, JAMENDO_CATEGORIES, type JamendoTrack } from '../lib/jamendo'
import {
  extractYouTubeVideoId,
  loadYouTubeIframeApi,
  searchYouTubeVideos,
  type YouTubeSearchResult,
} from '../lib/youtube'
import {
  createKaraokeAccumulator,
  sampleKaraoke,
  finalizeKaraokeScore,
  computeKaraokeAchievements,
  KARAOKE_SAMPLE_MS,
  KARAOKE_ACTIVE_THRESHOLD,
  KARAOKE_REACTION_EMOJIS,
  type KaraokeAccumulator,
  type KaraokeScoreResult,
  type KaraokePerformer,
} from '../lib/karaokeScore'

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
  topic: string | null
  theme: string
  max_seats: number
  owner_id: string
  watch_party_video_id: string | null
  watch_party_mode: 'karaoke' | 'together' | null
  watch_party_position_seconds: number
  watch_party_is_playing: boolean
  watch_party_updated_at: string | null
}

// Extrapolates "where the video should be right now" from the last
// position the owner persisted, plus elapsed wall-clock time if it was
// playing. Good enough for a catch-up seek - the live 2s sync heartbeat
// corrects any residual drift once the joining client is fully connected.
function estimateWatchPartyPosition(room: RoomRow): number {
  const base = room.watch_party_position_seconds ?? 0
  if (!room.watch_party_is_playing || !room.watch_party_updated_at) return base
  const elapsedSeconds = (Date.now() - new Date(room.watch_party_updated_at).getTime()) / 1000
  return base + Math.max(0, elapsedSeconds)
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
  const [seatInvite, setSeatInvite] = useState<{ fromUsername: string } | null>(null)

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
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsName, setSettingsName] = useState('')
  const [settingsTopic, setSettingsTopic] = useState('')
  const [settingsTheme, setSettingsTheme] = useState<RoomThemeId>('purple')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [nowPlaying, setNowPlaying] = useState<{ title: string; djUsername: string; paused: boolean } | null>(
    null,
  )
  const [musicStatus, setMusicStatus] = useState<'idle' | 'starting' | 'playing' | 'error'>('idle')
  const [musicError, setMusicError] = useState<string | null>(null)
  const [musicPaused, setMusicPaused] = useState(false)
  const [musicVolume, setMusicVolume] = useState(1)
  const [musicPickerOpen, setMusicPickerOpen] = useState(false)
  const [musicTab, setMusicTab] = useState<'device' | 'jamendo'>('device')
  const [jamendoQuery, setJamendoQuery] = useState('')
  const [jamendoResults, setJamendoResults] = useState<JamendoTrack[]>([])
  const [jamendoSearching, setJamendoSearching] = useState(false)
  const [jamendoError, setJamendoError] = useState<string | null>(null)
  const [jamendoCategory, setJamendoCategory] = useState<string | null>(null)

  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null)
  // Mode of the currently loaded/playing video (shown as a label, synced to
  // everyone). youtubeModalMode is the mode picked inside the modal before a
  // video is loaded - both use the same 'karaoke' | 'together' values.
  const [watchPartyMode, setWatchPartyMode] = useState<'karaoke' | 'together' | null>(null)
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false)
  const [youtubeModalMode, setYoutubeModalMode] = useState<'karaoke' | 'together' | null>(null)
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('')
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [youtubeTab, setYoutubeTab] = useState<'search' | 'link'>('search')
  const [youtubeQuery, setYoutubeQuery] = useState('')
  const [youtubeResults, setYoutubeResults] = useState<YouTubeSearchResult[]>([])
  const [youtubeSearching, setYoutubeSearching] = useState(false)

  const [karaokeResults, setKaraokeResults] = useState<KaraokePerformer[]>([])
  const [karaokeReactionCounts, setKaraokeReactionCounts] = useState<Record<string, Record<string, number>>>({})
  const [myKaraokeResult, setMyKaraokeResult] = useState<KaraokeScoreResult | null>(null)
  const [karaokeLiveDetected, setKaraokeLiveDetected] = useState(false)
  const [karaokeSampleCount, setKaraokeSampleCount] = useState(0)
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; left: number }[]>([])
  const floatingReactionIdRef = useRef(0)

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
  // Any type: YouTube's IFrame Player API has no bundled TS types here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ytPlayerRef = useRef<any>(null)
  const ytContainerRef = useRef<HTMLDivElement | null>(null)
  const ytSyncIntervalRef = useRef<number | null>(null)
  const karaokeAccRef = useRef<KaraokeAccumulator | null>(null)
  const karaokeNeverMutedRef = useRef(true)
  const karaokeSampleIntervalRef = useRef<number | null>(null)
  const resumedWatchPartyRef = useRef(false)
  // The 'youtube' broadcast handler is set up once inside a long-lived
  // effect (deps: [roomId, userId, slug]) and closes over isOwner at that
  // moment - room/ownership loads asynchronously after, so a plain
  // variable would go stale. Same fix as membersRef elsewhere in this file.
  const isOwnerRef = useRef(false)

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
      .select(
        'id, slug, name, topic, theme, max_seats, owner_id, watch_party_video_id, watch_party_mode, watch_party_position_seconds, watch_party_is_playing, watch_party_updated_at',
      )
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
    const mapped = rows.map((r) => ({
      user_id: r.user_id,
      seat_index: r.seat_index,
      is_muted: r.is_muted,
      username: r.profiles?.username ?? '?',
      equipped: r.profiles?.equipped ?? {},
    }))
    setMembers(mapped)
    return mapped
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
      .on('broadcast', { event: 'youtube' }, async ({ payload }) => {
        // The owner's own player is the source of truth, driven by their
        // real interactions with YouTube's native controls - it doesn't
        // react to its own broadcasts.
        if (isOwnerRef.current) return
        const p = payload as {
          action: 'load' | 'sync' | 'stop'
          videoId?: string
          time?: number
          state?: number
          mode?: 'karaoke' | 'together'
        }

        if (p.action === 'stop') {
          setYoutubeVideoId(null)
          setWatchPartyMode(null)
          ytPlayerRef.current?.stopVideo?.()
          finalizeMyKaraokeScore()
          return
        }
        if (p.action === 'load' && p.videoId) {
          setYoutubeVideoId(p.videoId)
          setWatchPartyMode(p.mode ?? null)
          resetKaraokeSession()
          const player = await ensureYtPlayer(false)
          player.loadVideoById({ videoId: p.videoId, startSeconds: p.time ?? 0 })
          return
        }
        if (p.action === 'sync' && p.time !== undefined) {
          const player = ytPlayerRef.current
          if (!player || typeof player.getCurrentTime !== 'function') return
          if (Math.abs(player.getCurrentTime() - p.time) > 1.5) player.seekTo(p.time, true)
          const localState = player.getPlayerState()
          if (p.state === 1 && localState !== 1) player.playVideo()
          else if (p.state === 2 && localState !== 2) player.pauseVideo()
        }
      })
      .on('broadcast', { event: 'karaoke_score' }, ({ payload }) => {
        const p = payload as KaraokePerformer
        setKaraokeResults((prev) => [...prev.filter((r) => r.userId !== p.userId), p])
      })
      .on('broadcast', { event: 'karaoke_reaction' }, ({ payload }) => {
        const p = payload as { targetUserId: string; emoji: string }
        setKaraokeReactionCounts((prev) => {
          const forTarget = { ...(prev[p.targetUserId] ?? {}) }
          forTarget[p.emoji] = (forTarget[p.emoji] ?? 0) + 1
          return { ...prev, [p.targetUserId]: forTarget }
        })
        spawnFloatingReaction(p.emoji)
      })
      // "Set as Singer": an invite, not a direct seat assignment - only the
      // invited person's own client acts on it, and only they can accept
      // (which then takes a seat through the normal self-service path).
      .on('broadcast', { event: 'seat_invite' }, ({ payload }) => {
        const p = payload as { targetUserId: string; fromUsername: string }
        if (p.targetUserId !== userId) return
        setSeatInvite({ fromUsername: p.fromUsername })
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
      if (ytSyncIntervalRef.current) clearInterval(ytSyncIntervalRef.current)
      ytPlayerRef.current?.destroy?.()
      ytPlayerRef.current = null
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

  // Lost our seat without calling leaveSeat ourselves - e.g. bumped by a
  // Karaoke Mode singer handoff. Our LiveKit token still has publish
  // granted from when we were seated (tokens aren't revoked live), so
  // reconnect to pick one up without it. Harmlessly redundant with
  // leaveSeat's own explicit reconnect for the self-service case.
  const prevMySeatRef = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    if (prevMySeatRef.current !== undefined && prevMySeatRef.current !== null && mySeat === null && slug) {
      connectVoice(slug)
    }
    prevMySeatRef.current = mySeat
  }, [mySeat, slug])

  const isOwner = room !== null && room !== 'not-found' && room.owner_id === userId
  useEffect(() => {
    isOwnerRef.current = isOwner
  }, [isOwner])

  // The room row is the source of truth for an in-progress Watch Party -
  // whoever (re)joins, including the owner refreshing their own browser,
  // resumes straight off it instead of needing a live round-trip to
  // whoever currently holds the "real" player. Runs once per room load;
  // the live 'youtube' broadcasts (sync/pause/etc.) take over from there.
  useEffect(() => {
    if (!room || room === 'not-found' || resumedWatchPartyRef.current) return
    if (!room.watch_party_video_id) return
    resumedWatchPartyRef.current = true
    const mode = room.watch_party_mode
    const videoId = room.watch_party_video_id
    const position = estimateWatchPartyPosition(room)
    setYoutubeVideoId(videoId)
    setWatchPartyMode(mode)
    resetKaraokeSession()
    ;(async () => {
      const player = await ensureYtPlayer(isOwnerRef.current)
      player.loadVideoById({ videoId, startSeconds: Math.max(0, position) })
      if (isOwnerRef.current) startYoutubeSyncHeartbeat()
    })()
  }, [room])

  // Fun Karaoke Scoring: while I'm seated during a Karaoke Mode session,
  // sample my own LiveKit mic level every 200ms against my own player's
  // song position. Self-reported per singer - see karaokeScore.ts for why.
  useEffect(() => {
    const active = watchPartyMode === 'karaoke' && youtubeVideoId !== null && mySeat !== null
    if (!active) {
      setKaraokeLiveDetected(false)
      return
    }
    if (!karaokeAccRef.current) {
      karaokeAccRef.current = createKaraokeAccumulator()
      karaokeNeverMutedRef.current = !myMuted
      setKaraokeSampleCount(0)
    }
    const id = window.setInterval(() => {
      const player = ytPlayerRef.current
      const lkRoom = livekitRoomRef.current
      if (!player || !lkRoom || typeof player.getDuration !== 'function') {
        setKaraokeLiveDetected(false)
        return
      }
      const duration = player.getDuration()
      if (!duration) return
      const ratio = Math.max(0, Math.min(1, player.getCurrentTime() / duration))
      const level = lkRoom.localParticipant.audioLevel ?? 0
      if (karaokeAccRef.current) {
        sampleKaraoke(karaokeAccRef.current, level, ratio)
        setKaraokeSampleCount(karaokeAccRef.current.samples)
      }
      setKaraokeLiveDetected(level > KARAOKE_ACTIVE_THRESHOLD)
    }, KARAOKE_SAMPLE_MS)
    karaokeSampleIntervalRef.current = id
    return () => {
      clearInterval(id)
      if (karaokeSampleIntervalRef.current === id) karaokeSampleIntervalRef.current = null
      setKaraokeLiveDetected(false)
    }
  }, [watchPartyMode, youtubeVideoId, mySeat])

  useEffect(() => {
    if (watchPartyMode === 'karaoke' && youtubeVideoId && mySeat !== null && myMuted) {
      karaokeNeverMutedRef.current = false
    }
  }, [myMuted, watchPartyMode, youtubeVideoId, mySeat])

  // Shared tail: write my own seat, refresh the roster, reconnect voice so
  // the LiveKit token reflects the new seat's publish permission. Both
  // self-service takeSeat and an accepted "Set as Singer" invite land here.
  async function assignMySeat(index: number) {
    if (!roomId || !userId || !slug) return
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

  async function takeSeat(index: number) {
    setSeatError(null)
    if (
      watchPartyMode === 'karaoke' &&
      youtubeVideoId &&
      members.some((m) => m.seat_index !== null && m.user_id !== userId)
    ) {
      setSeatError('Only one person can sing at a time during Karaoke Mode.')
      return
    }
    await assignMySeat(index)
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

  function setAsSinger(targetUserId: string) {
    const fromUsername = me?.username ?? 'Someone'
    channelRef.current?.send({
      type: 'broadcast',
      event: 'seat_invite',
      payload: { targetUserId, fromUsername },
    })
  }

  async function acceptSeatInvite() {
    setSeatInvite(null)
    setSeatError(null)
    if (!room || room === 'not-found' || !roomId || !userId) return
    const freshMembers = await loadMembers(roomId)
    // Karaoke Mode: only one singer at a time - accepting an invite hands
    // the mic over, so whoever currently holds a seat gets freed first.
    const currentSinger =
      watchPartyMode === 'karaoke' && youtubeVideoId
        ? freshMembers.find((m) => m.seat_index !== null && m.user_id !== userId)
        : undefined
    if (currentSinger) {
      await supabase
        .from('room_members')
        .update({ seat_index: null, is_muted: false })
        .eq('room_id', roomId)
        .eq('user_id', currentSinger.user_id)
    }
    const takenSeats = new Set(
      freshMembers
        .filter((m) => m.seat_index !== null && m.user_id !== currentSinger?.user_id)
        .map((m) => m.seat_index),
    )
    let freeSeat = -1
    for (let i = 0; i < room.max_seats; i++) {
      if (!takenSeats.has(i)) {
        freeSeat = i
        break
      }
    }
    if (freeSeat === -1) {
      setSeatError('No free mic seats right now.')
      return
    }
    await assignMySeat(freeSeat)
  }

  function declineSeatInvite() {
    setSeatInvite(null)
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

  // Shared by both music sources below: capture the hidden <audio>
  // element's output and publish it as an extra LiveKit track. Everyone
  // else's existing TrackSubscribed handler picks it up automatically,
  // same as any other audio track - no changes needed on the listening
  // side either way.
  async function startPlayingSource(src: string, title: string, opts?: { crossOrigin?: boolean }) {
    if (!roomId || !me || !isOwner) return

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
      if (opts?.crossOrigin) audioEl.crossOrigin = 'anonymous'
      else audioEl.removeAttribute('crossorigin')
      if (src.startsWith('blob:')) musicObjectUrlRef.current = src
      audioEl.src = src
      audioEl.loop = !opts?.crossOrigin
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
      setNowPlaying({ title, djUsername: me.username, paused: false })

      channelRef.current?.send({
        type: 'broadcast',
        event: 'music',
        payload: { action: 'play', title, djUsername: me.username },
      })
    } catch (err) {
      setMusicStatus('error')
      setMusicError(err instanceof Error ? err.message : 'Failed to play music')
    }
  }

  // Web apps can't read a phone's actual song library - there's no
  // browser API for that. This is the closest real equivalent: pick a
  // file each time via the native picker.
  async function handleMusicFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    await startPlayingSource(url, file.name)
  }

  async function handleJamendoPlay(track: JamendoTrack) {
    setMusicPickerOpen(false)
    await startPlayingSource(track.audio, `${track.name} (${track.artist_name})`, { crossOrigin: true })
  }

  async function handleJamendoSearch(e: React.FormEvent) {
    e.preventDefault()
    setJamendoCategory(null)
    setJamendoSearching(true)
    setJamendoError(null)
    try {
      setJamendoResults(await searchJamendoTracks(jamendoQuery))
    } catch (err) {
      setJamendoError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setJamendoSearching(false)
    }
  }

  async function handleJamendoCategory(tag: string, label: string) {
    setJamendoQuery('')
    setJamendoCategory(label)
    setJamendoSearching(true)
    setJamendoError(null)
    try {
      setJamendoResults(await fetchJamendoByTag(tag, label))
    } catch (err) {
      setJamendoError(err instanceof Error ? err.message : 'Failed to load category.')
    } finally {
      setJamendoSearching(false)
    }
  }


  function handleStopMusic() {
    if (!isOwner) return
    stopMusicLocal()
    setNowPlaying(null)
    channelRef.current?.send({ type: 'broadcast', event: 'music', payload: { action: 'stop' } })
  }

  function resetKaraokeSession() {
    karaokeAccRef.current = null
    karaokeNeverMutedRef.current = true
    setKaraokeResults([])
    setKaraokeReactionCounts({})
    setMyKaraokeResult(null)
    setKaraokeSampleCount(0)
    setKaraokeLiveDetected(false)
  }

  // Reads membersRef/userId at call time rather than closing over `me` -
  // this can be invoked from a long-lived player/broadcast callback whose
  // closure was created before the current render.
  function finalizeMyKaraokeScore() {
    const acc = karaokeAccRef.current
    karaokeAccRef.current = null
    if (karaokeSampleIntervalRef.current) {
      clearInterval(karaokeSampleIntervalRef.current)
      karaokeSampleIntervalRef.current = null
    }
    if (!acc || !userId) return
    const result = finalizeKaraokeScore(acc, karaokeNeverMutedRef.current)
    if (!result) return
    const username = membersRef.current.find((m) => m.user_id === userId)?.username ?? '?'
    const performer: KaraokePerformer = { userId, username, score: result }
    setMyKaraokeResult(result)
    setKaraokeResults((prev) => [...prev.filter((r) => r.userId !== userId), performer])
    channelRef.current?.send({ type: 'broadcast', event: 'karaoke_score', payload: performer })
  }

  function sendKaraokeReaction(targetUserId: string, emoji: string) {
    channelRef.current?.send({ type: 'broadcast', event: 'karaoke_reaction', payload: { targetUserId, emoji } })
    setKaraokeReactionCounts((prev) => {
      const forTarget = { ...(prev[targetUserId] ?? {}) }
      forTarget[emoji] = (forTarget[emoji] ?? 0) + 1
      return { ...prev, [targetUserId]: forTarget }
    })
    spawnFloatingReaction(emoji)
  }

  function spawnFloatingReaction(emoji: string) {
    const id = ++floatingReactionIdRef.current
    const left = 10 + Math.random() * 80
    setFloatingReactions((prev) => [...prev, { id, emoji, left }])
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id))
    }, 1800)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function ensureYtPlayer(controllable: boolean): Promise<any> {
    if (ytPlayerRef.current) return ytPlayerRef.current
    await loadYouTubeIframeApi()
    const YT = (window as unknown as { YT: any }).YT // eslint-disable-line @typescript-eslint/no-explicit-any
    return new Promise((resolve) => {
      const player = new YT.Player(ytContainerRef.current, {
        height: '200',
        width: '100%',
        playerVars: controllable ? { rel: 0 } : { rel: 0, controls: 0, disablekb: 1 },
        events: {
          onReady: () => {
            ytPlayerRef.current = player
            resolve(player)
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            // Natural end of video (state 0): finalize my own score, and
            // if I'm the owner, cascade a stop to the room. isOwnerRef is
            // read (not a plain variable) because this callback is
            // registered once, when the player is first created.
            if (e.data === 0) {
              finalizeMyKaraokeScore()
              if (isOwnerRef.current) handleStopYoutube()
              return
            }
            // Playing (1) or paused (2): keep the room row's resume point
            // fresh so a late joiner's estimate stays accurate. roomId is
            // stable for this component's whole lifetime (tied to slug),
            // so it's safe to read directly even from this long-lived
            // callback.
            if ((e.data === 1 || e.data === 2) && isOwnerRef.current && roomId) {
              const p = ytPlayerRef.current
              if (p && typeof p.getCurrentTime === 'function') {
                supabase
                  .from('rooms')
                  .update({
                    watch_party_position_seconds: p.getCurrentTime(),
                    watch_party_is_playing: e.data === 1,
                    watch_party_updated_at: new Date().toISOString(),
                  })
                  .eq('id', roomId)
                  .then(() => {})
              }
            }
          },
        },
      })
    })
  }

  function startYoutubeSyncHeartbeat() {
    if (ytSyncIntervalRef.current) return
    ytSyncIntervalRef.current = window.setInterval(() => {
      const player = ytPlayerRef.current
      if (!player || typeof player.getCurrentTime !== 'function') return
      channelRef.current?.send({
        type: 'broadcast',
        event: 'youtube',
        payload: { action: 'sync', time: player.getCurrentTime(), state: player.getPlayerState() },
      })
    }, 2000)
  }

  async function loadYoutubeVideo(videoId: string, mode: 'karaoke' | 'together') {
    if (!isOwner || !roomId) return
    setYoutubeError(null)
    setYoutubeModalOpen(false)
    setYoutubeVideoId(videoId)
    setWatchPartyMode(mode)
    resetKaraokeSession()
    const player = await ensureYtPlayer(true)
    player.loadVideoById(videoId)
    channelRef.current?.send({ type: 'broadcast', event: 'youtube', payload: { action: 'load', videoId, mode } })
    startYoutubeSyncHeartbeat()
    await supabase
      .from('rooms')
      .update({
        watch_party_video_id: videoId,
        watch_party_mode: mode,
        watch_party_position_seconds: 0,
        watch_party_is_playing: true,
        watch_party_updated_at: new Date().toISOString(),
      })
      .eq('id', roomId)
  }

  async function handleLoadYoutubeLink() {
    const videoId = extractYouTubeVideoId(youtubeUrlInput)
    if (!videoId) {
      setYoutubeError('Paste a valid YouTube link.')
      return
    }
    await loadYoutubeVideo(videoId, youtubeModalMode ?? 'together')
  }

  async function handleYoutubeSearch(e: React.FormEvent) {
    e.preventDefault()
    setYoutubeSearching(true)
    setYoutubeError(null)
    try {
      setYoutubeResults(await searchYouTubeVideos(youtubeQuery))
    } catch (err) {
      setYoutubeError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setYoutubeSearching(false)
    }
  }

  function handleStopYoutube() {
    if (!isOwnerRef.current) return
    if (ytSyncIntervalRef.current) {
      clearInterval(ytSyncIntervalRef.current)
      ytSyncIntervalRef.current = null
    }
    setYoutubeVideoId(null)
    setWatchPartyMode(null)
    ytPlayerRef.current?.stopVideo?.()
    channelRef.current?.send({ type: 'broadcast', event: 'youtube', payload: { action: 'stop' } })
    finalizeMyKaraokeScore()
    if (roomId) {
      supabase
        .from('rooms')
        .update({
          watch_party_video_id: null,
          watch_party_mode: null,
          watch_party_position_seconds: 0,
          watch_party_is_playing: true,
          watch_party_updated_at: null,
        })
        .eq('id', roomId)
        .then(() => {})
    }
  }

  function toggleMusicPause() {
    if (!isOwner) return
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
    if (!isOwner) return
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

  function openSettingsModal() {
    if (!room || room === 'not-found') return
    setSettingsName(room.name)
    setSettingsTopic(room.topic ?? '')
    setSettingsTheme((room.theme as RoomThemeId) ?? 'purple')
    setSettingsError(null)
    setSettingsModalOpen(true)
  }

  async function handleSaveSettings() {
    if (!room || room === 'not-found' || !isOwner || !settingsName.trim()) return
    setSettingsSaving(true)
    setSettingsError(null)
    try {
      await updateHangout(room.id, { name: settingsName, topic: settingsTopic, theme: settingsTheme })
      setRoom({
        ...room,
        name: settingsName.trim(),
        topic: settingsTopic.trim() || null,
        theme: settingsTheme,
      })
      setSettingsModalOpen(false)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSettingsSaving(false)
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
  const karaokeAchievements = computeKaraokeAchievements(karaokeResults, karaokeReactionCounts)
  // Karaoke Mode: only one singer at a time - empty seats are un-tappable
  // once someone else already holds the mic.
  const karaokeSeatLocked =
    watchPartyMode === 'karaoke' && !!youtubeVideoId && members.some((m) => m.seat_index !== null && m.user_id !== userId)
  const KARAOKE_ACHIEVEMENT_LABELS: Record<string, string> = {
    crowd_favorite: '🔥 Crowd Favorite',
    comedy_award: '😂 Comedy Award',
    no_stage_fright: '🎤 No Stage Fright',
  }
  function karaokeBadgesFor(userId: string, neverMuted: boolean): string[] {
    const badges: string[] = []
    if (karaokeAchievements.crowdFavoriteIds.has(userId)) badges.push('crowd_favorite')
    if (karaokeAchievements.comedyAwardIds.has(userId)) badges.push('comedy_award')
    if (neverMuted) badges.push('no_stage_fright')
    return badges
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div ref={audioContainerRef} className="hidden" />
      <audio ref={musicAudioElRef} onEnded={handleStopMusic} className="hidden" />
      <input
        ref={musicFileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleMusicFileChange}
      />

      <div className={`-mx-4 -mt-4 flex items-center justify-between bg-gradient-to-br p-4 ${getRoomThemeGradient(room.theme)}`}>
        <div>
          <h1 className="text-xl font-semibold text-white">{room.name}</h1>
          {room.topic && <p className="text-sm text-white/80">{room.topic}</p>}
          <p className="text-xs text-white/60">/r/{room.slug}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {isOwner && (
            <button
              onClick={openSettingsModal}
              className="rounded-lg border border-white/40 bg-black/20 px-3 py-1.5 text-sm font-medium text-white"
            >
              ⚙️
            </button>
          )}
          {isOwner && (
            <button
              onClick={openInvitePanel}
              className="rounded-lg border border-white/40 bg-black/20 px-3 py-1.5 text-sm font-medium text-white"
            >
              👥 Invite
            </button>
          )}
          {isOwner && musicStatus !== 'playing' && musicStatus !== 'starting' && (
            <button
              onClick={() => setMusicPickerOpen(true)}
              className="rounded-lg border border-white/40 bg-black/20 px-3 py-1.5 text-sm font-medium text-white"
            >
              🎵 Play music
            </button>
          )}
          {isOwner && !youtubeVideoId && (
            <button
              onClick={() => {
                setYoutubeModalMode(null)
                setYoutubeModalOpen(true)
              }}
              className="rounded-lg border border-white/40 bg-black/20 px-3 py-1.5 text-sm font-medium text-white"
            >
              🎉 Watch Party
            </button>
          )}
          <button
            onClick={() => setGiftModalOpen(true)}
            className="rounded-lg border border-white/40 bg-black/20 px-3 py-1.5 text-sm font-medium text-white"
          >
            🎁 Gift
          </button>
          <button
            onClick={leaveRoom}
            className="rounded-lg border border-white/40 bg-black/20 px-3 py-1.5 text-sm text-white"
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
                onClick={() => setMusicPickerOpen(true)}
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

      {youtubeModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="mx-4 flex max-h-[80vh] w-full max-w-xs flex-col rounded-2xl bg-zinc-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {youtubeModalMode && (
                  <button
                    onClick={() => setYoutubeModalMode(null)}
                    className="mr-1 text-zinc-400 hover:text-white"
                    aria-label="Back"
                  >
                    ‹
                  </button>
                )}
                <p className="text-sm font-medium text-white">
                  {youtubeModalMode === 'karaoke'
                    ? 'Karaoke Mode'
                    : youtubeModalMode === 'together'
                      ? 'Watch Together'
                      : '🎉 Watch Party'}
                </p>
              </div>
              <button onClick={() => setYoutubeModalOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            {youtubeModalMode === null ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setYoutubeModalMode('karaoke')}
                  className="rounded-lg border border-zinc-700 p-3 text-left hover:bg-zinc-800"
                >
                  <p className="text-sm font-medium text-white">🎤 Karaoke Mode</p>
                  <p className="text-xs text-zinc-500">Sing along to a karaoke video together.</p>
                </button>
                <button
                  onClick={() => setYoutubeModalMode('together')}
                  className="rounded-lg border border-zinc-700 p-3 text-left hover:bg-zinc-800"
                >
                  <p className="text-sm font-medium text-white">🎬 Watch Together</p>
                  <p className="text-xs text-zinc-500">Watch any YouTube video in sync with the room.</p>
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => setYoutubeTab('search')}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      youtubeTab === 'search' ? 'bg-purple-600 text-white' : 'border border-zinc-700 text-zinc-300'
                    }`}
                  >
                    Search
                  </button>
                  <button
                    onClick={() => setYoutubeTab('link')}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      youtubeTab === 'link' ? 'bg-purple-600 text-white' : 'border border-zinc-700 text-zinc-300'
                    }`}
                  >
                    Paste link
                  </button>
                </div>

                {youtubeTab === 'link' ? (
                  <>
                    <p className="mb-2 text-xs text-zinc-500">
                      {youtubeModalMode === 'karaoke'
                        ? 'Paste a YouTube link, e.g. a karaoke/lyrics video.'
                        : 'Paste any YouTube link to watch together.'}
                    </p>
                    <input
                      type="text"
                      value={youtubeUrlInput}
                      onChange={(e) => setYoutubeUrlInput(e.target.value)}
                      placeholder="https://youtube.com/watch?v=…"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                    />
                    {youtubeError && <p className="mt-1 text-xs text-red-400">{youtubeError}</p>}
                    <button
                      onClick={handleLoadYoutubeLink}
                      disabled={!youtubeUrlInput.trim()}
                      className="mt-2 w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Load for everyone
                    </button>
                  </>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <form onSubmit={handleYoutubeSearch} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={youtubeModalMode === 'karaoke' ? 'Search your favorite song' : 'Search any video'}
                        value={youtubeQuery}
                        onChange={(e) => setYoutubeQuery(e.target.value)}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={youtubeSearching}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {youtubeSearching ? '…' : 'Search'}
                      </button>
                    </form>
                    {youtubeError && <p className="text-xs text-red-400">{youtubeError}</p>}
                    <div className="flex-1 overflow-y-auto">
                      {youtubeResults.length === 0 ? (
                        <p className="py-4 text-center text-xs text-zinc-500">
                          {youtubeModalMode === 'karaoke' ? 'Search for your favorite song.' : 'Search for a video.'}
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {youtubeResults.map((r) => (
                            <button
                              key={r.videoId}
                              onClick={() => loadYoutubeVideo(r.videoId, youtubeModalMode)}
                              className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-zinc-800"
                            >
                              <img src={r.thumbnailUrl} alt="" className="h-10 w-14 rounded object-cover" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium text-white">{r.title}</span>
                                <span className="block truncate text-xs text-zinc-500">{r.channelTitle}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className={youtubeVideoId ? 'flex flex-col gap-2' : 'hidden'}>
        {watchPartyMode && (
          <p className="text-xs text-zinc-500">
            {watchPartyMode === 'karaoke' ? '🎤 Karaoke Mode' : '🎬 Watch Together'}
          </p>
        )}
        <div
          ref={ytContainerRef}
          className={`overflow-hidden rounded-lg ${isOwner ? '' : 'pointer-events-none'}`}
        />
        {isOwner && (
          <button
            onClick={handleStopYoutube}
            className="self-start rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
          >
            ⏹ Stop {watchPartyMode === 'karaoke' ? 'Karaoke Mode' : 'Watch Party'}
          </button>
        )}
      </div>

      {!youtubeVideoId && karaokeResults.length > 0 && (
        <div className="rounded-lg border border-purple-800/50 bg-purple-950/30 p-3">
          <p className="mb-2 text-sm font-medium text-white">🎤 Karaoke Results</p>
          <div className="flex flex-col gap-2">
            {karaokeResults.map((r) => (
              <div key={r.userId} className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-200">{r.username}</span>
                  <span className="text-amber-400">
                    {'⭐'.repeat(r.score.stars)}
                    <span className="text-zinc-600">{'☆'.repeat(5 - r.score.stars)}</span>
                    <span className="ml-1 text-xs text-zinc-500">{r.score.finalScore}</span>
                  </span>
                </div>
                {karaokeBadgesFor(r.userId, r.score.neverMuted).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {karaokeBadgesFor(r.userId, r.score.neverMuted).map((b) => (
                      <span key={b} className="rounded-full bg-purple-900/60 px-2 py-0.5 text-xs text-purple-300">
                        {KARAOKE_ACHIEVEMENT_LABELS[b]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {myKaraokeResult && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
          <div className="mx-4 w-full max-w-xs rounded-2xl bg-zinc-900 p-5 text-center">
            <p className="text-lg font-semibold text-white">🎤 Great Performance!</p>
            <p className="mt-2 text-2xl text-amber-400">
              {'⭐'.repeat(myKaraokeResult.stars)}
              <span className="text-zinc-700">{'☆'.repeat(5 - myKaraokeResult.stars)}</span>
            </p>
            <div className="mt-4 space-y-1 text-left text-sm text-zinc-300">
              <p>Timing: {myKaraokeResult.timing}%</p>
              <p>Participation: {myKaraokeResult.participation}%</p>
              <p>Energy: {myKaraokeResult.energy}%</p>
              <p>Consistency: {myKaraokeResult.consistency}%</p>
            </div>
            <p className="mt-3 text-lg font-bold text-purple-400">Final Score: {myKaraokeResult.finalScore}</p>
            {userId && karaokeBadgesFor(userId, myKaraokeResult.neverMuted).length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {karaokeBadgesFor(userId, myKaraokeResult.neverMuted).map((b) => (
                  <span key={b} className="rounded-full bg-purple-950/60 px-2 py-1 text-xs text-purple-300">
                    {KARAOKE_ACHIEVEMENT_LABELS[b]}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => setMyKaraokeResult(null)}
              className="mt-4 w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white"
            >
              Nice!
            </button>
          </div>
        </div>
      )}

      {seatInvite && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="mx-4 w-full max-w-xs rounded-2xl bg-zinc-900 p-5 text-center">
            <p className="text-white">
              <span className="font-medium">{seatInvite.fromUsername}</span> invited you to grab a seat
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={acceptSeatInvite}
                className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white"
              >
                Accept
              </button>
              <button
                onClick={declineSeatInvite}
                className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden">
        {floatingReactions.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-10">
            {floatingReactions.map((r) => (
              <span
                key={r.id}
                className="floating-reaction absolute bottom-0 text-2xl"
                style={{ left: `${r.left}%` }}
              >
                {r.emoji}
              </span>
            ))}
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
                  disabled={(!occupant && mySeat === i) || (!occupant && karaokeSeatLocked)}
                  title={!occupant && karaokeSeatLocked ? 'Only one person can sing at a time during Karaoke Mode' : undefined}
                  className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 text-white disabled:cursor-not-allowed disabled:opacity-40 ${
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
              {occupant && !isMe && watchPartyMode === 'karaoke' && youtubeVideoId && (
                <div className="flex flex-wrap justify-center gap-1">
                  {KARAOKE_REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendKaraokeReaction(occupant.user_id, emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-lg leading-none transition-transform active:scale-150"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        </div>
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
      {mySeat !== null && watchPartyMode === 'karaoke' && youtubeVideoId && (
        <p
          className={`text-center text-xs ${karaokeLiveDetected ? 'text-green-400' : 'text-zinc-600'}`}
        >
          🎤 {karaokeLiveDetected ? 'Singing detected!' : 'Listening for your voice…'}
          <span className="text-zinc-700"> ({karaokeSampleCount} samples)</span>
        </p>
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
              {isOwner && l.user_id !== userId && watchPartyMode === 'karaoke' && youtubeVideoId && (
                <button
                  onClick={() => setAsSinger(l.user_id)}
                  className="rounded-full bg-purple-900/60 px-1.5 py-0.5 text-xs text-purple-300"
                  title="Invite this person to grab a seat so they can sing and get scored"
                >
                  🎤 Set as Singer
                </button>
              )}
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

      {settingsModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-xs rounded-2xl bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Room settings</p>
              <button onClick={() => setSettingsModalOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            <label className="mb-1 block text-xs text-zinc-500">Name</label>
            <input
              type="text"
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              maxLength={40}
              className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />

            <label className="mb-1 block text-xs text-zinc-500">Topic (optional)</label>
            <input
              type="text"
              value={settingsTopic}
              onChange={(e) => setSettingsTopic(e.target.value)}
              maxLength={60}
              className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            />

            <label className="mb-1 block text-xs text-zinc-500">Theme</label>
            <div className="mb-3 flex gap-2">
              {ROOM_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSettingsTheme(t.id)}
                  title={t.label}
                  className={`h-8 w-8 rounded-full bg-gradient-to-br ${t.gradient} ${
                    settingsTheme === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''
                  }`}
                />
              ))}
            </div>

            {settingsError && <p className="mb-2 text-xs text-red-400">{settingsError}</p>}
            <button
              onClick={handleSaveSettings}
              disabled={settingsSaving || !settingsName.trim()}
              className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {settingsSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {musicPickerOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="mx-4 flex max-h-[80vh] w-full max-w-xs flex-col rounded-2xl bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Play music</p>
              <button
                onClick={() => setMusicPickerOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setMusicTab('device')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  musicTab === 'device' ? 'bg-purple-600 text-white' : 'border border-zinc-700 text-zinc-300'
                }`}
              >
                This device
              </button>
              <button
                onClick={() => setMusicTab('jamendo')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  musicTab === 'jamendo' ? 'bg-purple-600 text-white' : 'border border-zinc-700 text-zinc-300'
                }`}
              >
                Cloud (Jamendo)
              </button>
            </div>

            {musicTab === 'device' ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-xs text-zinc-500">
                  Pick a song from your device. It'll stream to everyone in the room.
                </p>
                <button
                  onClick={() => {
                    setMusicPickerOpen(false)
                    musicFileInputRef.current?.click()
                  }}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Choose a file
                </button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {JAMENDO_CATEGORIES.map((c) => (
                    <button
                      key={c.tag}
                      onClick={() => handleJamendoCategory(c.tag, c.label)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        jamendoCategory === c.label
                          ? 'border-purple-500 bg-purple-600 text-white'
                          : 'border-zinc-700 text-zinc-300'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleJamendoSearch} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search free/CC tracks…"
                    value={jamendoQuery}
                    onChange={(e) => setJamendoQuery(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={jamendoSearching}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {jamendoSearching ? '…' : 'Search'}
                  </button>
                </form>
                {jamendoError && <p className="text-xs text-red-400">{jamendoError}</p>}
                <div className="flex-1 overflow-y-auto">
                  {jamendoResults.length === 0 ? (
                    <p className="py-4 text-center text-xs text-zinc-500">
                      Pick a category above, or search for a track.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {jamendoResults.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleJamendoPlay(t)}
                          className="rounded-lg px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          <span className="font-medium text-white">{t.name}</span> - {t.artist_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
