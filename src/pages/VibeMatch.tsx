import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { blockUser, reportUser } from '../lib/safety'
import { fetchMatchVoiceToken, LIVEKIT_URL } from '../lib/livekit'
import {
  requestMatch,
  endMatch,
  likeMatchPartner,
  markMatchReady,
  getSessionState,
  getMyVoiceMinglesRemaining,
  fetchMatchMessages,
  sendMatchMessage,
  DEFAULT_MATCH_PREFERENCES,
  type MatchSession,
  type MatchMessage,
  type MatchPreferences,
} from '../lib/match'
import { openFriendChat } from '../lib/friends'

type Phase = 'select' | 'waiting' | 'matched' | 'partner-left' | 'time-up' | 'no-match'
type Partner = { id: string; username: string; equipped: Record<string, string> }

const WAITING_POLL_MS = 2500
const STATE_POLL_MS = 3000
const MESSAGE_POLL_MS = 3000
const LIKE_UNLOCK_SEC = 90
const HEART_PROMPT_SEC = 120
const MATCH_DEADLINE_SEC = 180
// Separate concept from MATCH_DEADLINE_SEC even though it's the same
// duration today - this is "nobody to pair with," that one is "we paired
// but didn't both like in time." Keeping them apart so they can be tuned
// independently later.
const WAITING_TIMEOUT_SEC = 180
const REPORT_REASONS = ['Harassment', 'Underage', 'Spam', 'Inappropriate content', 'Other']
const WAITING_MESSAGES = [
  'Looking for someone…',
  'Scanning the Mingleverse…',
  'Matching your vibe…',
  'Almost there…',
]

function formatCountdown(secondsLeft: number) {
  const s = Math.max(0, secondsLeft)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function VibeMatch() {
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useAuthStore((s) => s.session?.user.id)

  const [phase, setPhase] = useState<Phase>('select')
  const [session, setSession] = useState<MatchSession | null>(null)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [messages, setMessages] = useState<MatchMessage[]>([])
  const [input, setInput] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [likes, setLikes] = useState({ liked_a: false, liked_b: false })
  const [ready, setReady] = useState({ ready_a: false, ready_b: false })
  const [likeBusy, setLikeBusy] = useState(false)
  const [justBecameFriends, setJustBecameFriends] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [pendingMode, setPendingMode] = useState<'text' | 'voice'>('text')
  const [pendingPrefs, setPendingPrefs] = useState<MatchPreferences>(DEFAULT_MATCH_PREFERENCES)
  const [genderPref, setGenderPref] = useState<'any' | 'male' | 'female'>('any')
  const [ageMin, setAgeMin] = useState(18)
  const [ageMax, setAgeMax] = useState(69)
  const [voiceStatus, setVoiceStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [voiceMinglesLeft, setVoiceMinglesLeft] = useState<number | null>(null)
  const [waitingMsgIndex, setWaitingMsgIndex] = useState(0)
  const [waitingElapsed, setWaitingElapsed] = useState(0)
  const [retryingReady, setRetryingReady] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const audioContainerRef = useRef<HTMLDivElement | null>(null)
  const livekitRoomRef = useRef<Room | null>(null)
  const timeoutHandledRef = useRef(false)
  const chatTransitionStartedRef = useRef(false)

  const iAmA = session?.user_a === userId
  const iLiked = iAmA ? likes.liked_a : likes.liked_b
  const partnerLiked = iAmA ? likes.liked_b : likes.liked_a
  const bothLiked = likes.liked_a && likes.liked_b
  const bothReady = ready.ready_a && ready.ready_b

  // Tracked for the unmount cleanup below — a plain effect dependency
  // would fire cleanup on every phase change, not just on leaving the page.
  const stateRef = useRef({ phase, session })
  stateRef.current = { phase, session }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useEffect(() => {
    getMyVoiceMinglesRemaining().then(setVoiceMinglesLeft).catch(() => {})
  }, [])

  // Home's Text/Voice tiles skip the select screen and jump straight into
  // a search, passed via navigation state rather than a URL param since
  // it's a one-time trigger, not a shareable/bookmarkable page state.
  useEffect(() => {
    const autoMode = (location.state as { mode?: 'text' | 'voice' } | null)?.mode
    if (autoMode === 'text' || autoMode === 'voice') {
      startSearching(autoMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Leaving the page mid-search or mid-match tears things down — matches
  // are ephemeral, not a persistent conversation to come back to.
  useEffect(() => {
    return () => {
      const { phase: p, session: s } = stateRef.current
      if (p === 'matched' && s) {
        endMatch(s.id).catch(() => {})
      } else if (p === 'waiting' && userId) {
        supabase.from('match_queue').delete().eq('user_id', userId).then(() => {})
      }
    }
  }, [userId])

  async function loadPartner(s: MatchSession) {
    const partnerId = s.user_a === userId ? s.user_b : s.user_a
    const { data } = await supabase
      .from('profiles')
      .select('id, username, equipped')
      .eq('id', partnerId)
      .maybeSingle()
    setPartner(data)
  }

  async function enterMatch(found: MatchSession) {
    timeoutHandledRef.current = false
    setElapsed(0)
    setLikes({ liked_a: found.liked_a, liked_b: found.liked_b })
    setReady({ ready_a: found.ready_a, ready_b: found.ready_b })
    setJustBecameFriends(false)
    setSession(found)
    setPhase('matched')
    if (found.mode === 'voice') {
      setVoiceMinglesLeft((n) => (n === null ? n : Math.max(0, n - 1)))
    }

    // Only mark ourselves ready once we've actually loaded the partner —
    // this is the "both sides have each other in their interfaces" check.
    // Chat/voice stays gated behind bothReady until the poll below sees
    // the partner has done the same on their side.
    await loadPartner(found)
    try {
      const updated = await markMatchReady(found.id)
      setReady({ ready_a: updated.ready_a, ready_b: updated.ready_b })
    } catch (err) {
      // Surface it instead of swallowing - a silent failure here reads
      // identically to "still syncing" and is exactly what makes
      // "Connecting..." look permanently stuck with no clue why.
      setError(err instanceof Error ? `Couldn't confirm ready: ${err.message}` : "Couldn't confirm ready.")
    }
  }

  async function retryReady() {
    if (!session || retryingReady) return
    setRetryingReady(true)
    setError(null)
    try {
      const updated = await markMatchReady(session.id)
      setReady({ ready_a: updated.ready_a, ready_b: updated.ready_b })
      setLikes({ liked_a: updated.liked_a, liked_b: updated.liked_b })
    } catch (err) {
      setError(err instanceof Error ? `Retry failed: ${err.message}` : 'Retry failed.')
    } finally {
      setRetryingReady(false)
    }
  }

  async function startSearching(mode: 'text' | 'voice' = pendingMode, prefs: MatchPreferences = pendingPrefs) {
    setPendingMode(mode)
    setPendingPrefs(prefs)
    setError(null)
    setPhase('waiting')
    try {
      const found = await requestMatch(mode, prefs)
      if (found) enterMatch(found)
    } catch (err) {
      if (err instanceof Error && err.message.includes('voice_limit_reached')) {
        setVoiceMinglesLeft(0)
        setError("You've used today's 5 free Voice Mingles. Try text, or come back tomorrow.")
      } else if (err instanceof Error && err.message.includes('account_banned')) {
        setError('Your account has been suspended.')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
      setPhase('select')
    }
  }

  function leaveToHome() {
    if (userId) supabase.from('match_queue').delete().eq('user_id', userId).then(() => {})
    navigate('/')
  }

  // While waiting, keep asking to be matched — request_match() is also
  // how we discover that someone else just matched with us.
  useEffect(() => {
    if (phase !== 'waiting') return
    const id = setInterval(async () => {
      try {
        const found = await requestMatch(pendingMode, pendingPrefs)
        if (found) enterMatch(found)
      } catch {
        // Transient errors just get retried on the next tick.
      }
    }, WAITING_POLL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, userId, pendingMode, pendingPrefs])

  // Nobody to pair with after WAITING_TIMEOUT_SEC — stop polling and ask
  // instead of leaving the spinner running forever. Explicitly drops the
  // queue row here rather than relying on the unmount cleanup, since
  // 'no-match' isn't 'waiting' anymore and shouldn't be left dangling in
  // match_queue if the user just closes the tab on this screen.
  useEffect(() => {
    if (phase !== 'waiting') return
    const id = setTimeout(async () => {
      if (userId) await supabase.from('match_queue').delete().eq('user_id', userId)
      setPhase('no-match')
    }, WAITING_TIMEOUT_SEC * 1000)
    return () => clearTimeout(id)
  }, [phase, userId])

  // Cosmetic only: cycle the status line and tick a "how long we've been
  // searching" counter so the waiting screen reads as actively searching
  // rather than a frozen spinner.
  useEffect(() => {
    if (phase !== 'waiting') {
      setWaitingMsgIndex(0)
      setWaitingElapsed(0)
      return
    }
    const msgId = setInterval(() => {
      setWaitingMsgIndex((i) => (i + 1) % WAITING_MESSAGES.length)
    }, 3000)
    const elapsedId = setInterval(() => setWaitingElapsed((s) => s + 1), 1000)
    return () => {
      clearInterval(msgId)
      clearInterval(elapsedId)
    }
  }, [phase])

  // While matched, watch for the partner ending the session (Next, block,
  // leaving) and keep our copy of both like flags fresh.
  useEffect(() => {
    if (phase !== 'matched' || !session) return
    const id = setInterval(async () => {
      try {
        const state = await getSessionState(session.id)
        if (!state) return
        if (state.ended_at) {
          setPhase('partner-left')
          return
        }
        setLikes({ liked_a: state.liked_a, liked_b: state.liked_b })
        setReady({ ready_a: state.ready_a, ready_b: state.ready_b })
        // Belt and suspenders: enterMatch()'s own markMatchReady call is
        // fire-and-forget on failure (a comment there says "the next poll
        // will pick this up," but the poll only ever read state - it never
        // actually retried). If our own ready flag never landed, both sides
        // could be stuck on "Connecting..." forever. Retry it here instead.
        const myReady = session.user_a === userId ? state.ready_a : state.ready_b
        if (!myReady) {
          await markMatchReady(session.id)
        }
      } catch (err) {
        // A failure here used to be invisible - the poll would just keep
        // silently re-trying forever with nothing on screen to explain
        // why "Connecting..." never clears. Surface it.
        setError(err instanceof Error ? `Sync error: ${err.message}` : 'Sync error.')
      }
    }, STATE_POLL_MS)
    return () => clearInterval(id)
  }, [phase, session, userId])

  // Auto-resume searching a moment after the partner leaves. Hitting the
  // 3-minute deadline ourselves is different — that one waits for an
  // explicit tap (see the 'time-up' branch below).
  useEffect(() => {
    if (phase !== 'partner-left') return
    const id = setTimeout(() => startSearching(), 1500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // The 3-minute clock: past the deadline, either both hearts are in (in
  // which case the timer just stops mattering) or the match ends and asks
  // the user to move on. Counts locally from 0 rather than comparing
  // Date.now() against session.created_at - a device clock that's off in
  // any way (wrong timezone, wrong date, anything) used to make a
  // brand-new match look already expired the instant it started.
  useEffect(() => {
    if (phase !== 'matched' || !session) return
    let secs = 0
    const id = setInterval(() => {
      secs += 1
      setElapsed(secs)
      if (secs >= MATCH_DEADLINE_SEC && !timeoutHandledRef.current) {
        setLikes((current) => {
          if (!(current.liked_a && current.liked_b)) {
            timeoutHandledRef.current = true
            endMatch(session.id).catch(() => {})
            setPhase('time-up')
          }
          return current
        })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, session])

  useEffect(() => {
    if (phase !== 'matched' || !session || session.mode !== 'text') return
    let active = true

    async function refresh() {
      const msgs = await fetchMatchMessages(session!.id)
      if (active) setMessages(msgs)
    }
    refresh()

    const channel = supabase
      .channel(`match:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as MatchMessage
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .subscribe()

    const pollId = setInterval(refresh, MESSAGE_POLL_MS)

    return () => {
      active = false
      clearInterval(pollId)
      supabase.removeChannel(channel)
    }
  }, [phase, session])

  // Voice mode: connect to the per-session LiveKit room. Both participants
  // in an active voice match can always publish (see livekit-match-token)
  // — there's no seat concept for a 1:1 match. Torn down whenever we leave
  // 'matched' (Next, block, partner-left, time-up) or unmount, same as the
  // text chat subscription above.
  useEffect(() => {
    if (phase !== 'matched' || !session || session.mode !== 'voice') return
    if (!LIVEKIT_URL) {
      setVoiceStatus('error')
      setVoiceError('Voice is not configured.')
      return
    }
    let cancelled = false
    setVoiceStatus('connecting')
    setVoiceError(null)
    setIsMuted(false)

    async function connect() {
      try {
        const token = await fetchMatchVoiceToken(session!.id)
        if (cancelled) return
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
        // Don't wait for the 3s match_sessions poll to notice a dropped
        // call (app killed, network loss) — react to LiveKit itself.
        lkRoom.on(RoomEvent.ParticipantDisconnected, () => {
          if (cancelled) return
          endMatch(session!.id).catch(() => {})
          setPhase('partner-left')
        })
        livekitRoomRef.current = lkRoom
        await lkRoom.connect(LIVEKIT_URL!, token)
        if (cancelled) {
          await lkRoom.disconnect()
          return
        }
        await lkRoom.localParticipant.setMicrophoneEnabled(true)
        setVoiceStatus('connected')
      } catch (err) {
        if (!cancelled) {
          setVoiceStatus('error')
          setVoiceError(err instanceof Error ? err.message : 'Failed to connect voice')
        }
      }
    }
    connect()

    return () => {
      cancelled = true
      livekitRoomRef.current?.disconnect()
      livekitRoomRef.current = null
    }
  }, [phase, session])

  async function toggleMute() {
    const lkRoom = livekitRoomRef.current
    if (!lkRoom) return
    const next = !isMuted
    await lkRoom.localParticipant.setMicrophoneEnabled(!next)
    setIsMuted(next)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !userId || !input.trim()) return
    const body = input.trim()
    setInput('')
    try {
      await sendMatchMessage(session.id, userId, body)
    } catch {
      setError('Message failed to send.')
    }
  }

  async function handleLike() {
    if (!session || likeBusy) return
    setLikeBusy(true)
    try {
      const updated = await likeMatchPartner(session.id)
      const nowBoth = updated.liked_a && updated.liked_b
      if (nowBoth && !bothLiked) setJustBecameFriends(true)
      setLikes({ liked_a: updated.liked_a, liked_b: updated.liked_b })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLikeBusy(false)
    }
  }

  // Text matches that turn into a mutual like shouldn't stay stuck in the
  // ephemeral match view (tied to a session that eventually gets cleaned
  // up) - they're friends now, so the conversation continues in the same
  // persistent chat a friend gets from the Friends list. Voice matches
  // aren't a text conversation to hand off, so this is text-only. Keyed
  // off bothLiked (not justBecameFriends, which only fires for whichever
  // side's own tap completed the match) so it fires for both people.
  useEffect(() => {
    if (!bothLiked || !session || session.mode !== 'text' || !partner) return
    if (chatTransitionStartedRef.current) return
    chatTransitionStartedRef.current = true
    const t = setTimeout(async () => {
      try {
        const threadId = await openFriendChat(partner.id)
        await endMatch(session.id).catch(() => {})
        navigate(`/dm/${threadId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [bothLiked, session, partner, navigate])

  async function handleNext() {
    if (!session) return
    setMessages([])
    setPartner(null)
    try {
      await endMatch(session.id)
    } catch {
      // Still move on — the session will time out server-side either way.
    }
    setSession(null)
    startSearching()
  }

  async function handleBlock() {
    if (!partner) return
    setBlockBusy(true)
    try {
      await blockUser(partner.id)
      setMessages([])
      setSession(null)
      setPartner(null)
      startSearching()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBlockBusy(false)
    }
  }

  async function submitReport() {
    if (!partner || !reportReason) return
    setReportBusy(true)
    try {
      await reportUser(partner.id, reportReason, undefined, session?.id)
      setReportDone(true)
      setReporting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setReportBusy(false)
    }
  }

  if (phase === 'select') {
    return (
      <div className="page-enter mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <button onClick={() => navigate('/')} className="self-start text-sm text-zinc-400 hover:text-white">
          ← Back
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">✨ Start Mingling</h1>
          <p className="mt-1 text-sm text-zinc-400">Meet someone new, right now.</p>
        </div>
        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Match with</p>
            <div className="flex gap-2">
              {(['any', 'male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenderPref(g)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    genderPref === g
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'border border-zinc-700 text-zinc-400'
                  }`}
                >
                  {g === 'any' ? 'Anyone' : g === 'male' ? '♂ Male' : '♀ Female'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Age range ({ageMin}–{ageMax})
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="range"
                min={18}
                max={69}
                value={ageMin}
                onChange={(e) => setAgeMin(Math.min(Number(e.target.value), ageMax))}
                className="w-full accent-purple-500"
              />
              <input
                type="range"
                min={18}
                max={69}
                value={ageMax}
                onChange={(e) => setAgeMax(Math.max(Number(e.target.value), ageMin))}
                className="w-full accent-pink-500"
              />
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() =>
              startSearching('text', {
                genderPref: genderPref === 'any' ? null : genderPref,
                minAge: ageMin,
                maxAge: ageMax,
              })
            }
            className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-4 text-left shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.97]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/20 text-2xl">
              💬
            </span>
            <span>
              <span className="block font-semibold text-white">Chat</span>
              <span className="block text-xs text-white/70">Match and chat via messages</span>
            </span>
          </button>
          <button
            onClick={() =>
              startSearching('voice', {
                genderPref: genderPref === 'any' ? null : genderPref,
                minAge: ageMin,
                maxAge: ageMax,
              })
            }
            disabled={voiceMinglesLeft === 0}
            className="flex items-center gap-4 rounded-2xl border border-purple-600/60 bg-zinc-900/60 p-4 text-left transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:opacity-50"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-600/15 text-2xl">
              🎤
            </span>
            <span>
              <span className="block font-semibold text-white">Voice Chat</span>
              <span className="block text-xs text-zinc-400">Talk face to face</span>
            </span>
          </button>
          <p className="text-center text-xs text-zinc-500">
            {voiceMinglesLeft === 0
              ? "🎤 You've used today's 5 free Voice Mingles"
              : voiceMinglesLeft !== null
                ? `🎤 ${voiceMinglesLeft} free Voice Mingle${voiceMinglesLeft === 1 ? '' : 's'} left today`
                : ''}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'waiting' || phase === 'partner-left' || phase === 'time-up' || phase === 'no-match') {
    const copy =
      phase === 'partner-left'
        ? 'They left. Finding someone new…'
        : phase === 'time-up'
          ? "Time's up!"
          : phase === 'no-match'
            ? "No one's available right now"
            : WAITING_MESSAGES[waitingMsgIndex]
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
        {(phase === 'waiting' || phase === 'partner-left') && (
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span className="radar-ring absolute inset-0 rounded-full border-2 border-purple-500/50" />
            <span
              className="radar-ring absolute inset-0 rounded-full border-2 border-purple-500/50"
              style={{ animationDelay: '0.7s' }}
            />
            <span
              className="radar-ring absolute inset-0 rounded-full border-2 border-purple-500/50"
              style={{ animationDelay: '1.4s' }}
            />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-2xl shadow-lg shadow-purple-950/40">
              ✨
            </span>
          </div>
        )}
        <p className="text-white">{copy}</p>
        {phase === 'waiting' && (
          <p className="text-xs text-zinc-500">Searching for {formatCountdown(waitingElapsed)}</p>
        )}
        {phase === 'time-up' ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-zinc-400">
              You two didn't both like each other in time. That's how it stays fair for everyone.
            </p>
            <button
              onClick={() => startSearching()}
              className="rounded-full bg-purple-600 px-5 py-2.5 font-medium text-white"
            >
              Find someone new →
            </button>
            <button onClick={leaveToHome} className="text-sm text-zinc-400 hover:text-white">
              Back to home
            </button>
          </div>
        ) : phase === 'no-match' ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-zinc-400">Nobody was free to match with this time.</p>
            <button
              onClick={() => startSearching()}
              className="rounded-full bg-purple-600 px-5 py-2.5 font-medium text-white"
            >
              Try again →
            </button>
            <button onClick={leaveToHome} className="text-sm text-zinc-400 hover:text-white">
              Try later
            </button>
          </div>
        ) : (
          <button onClick={leaveToHome} className="text-sm text-zinc-400 hover:text-white">
            Cancel
          </button>
        )}
      </div>
    )
  }

  const secondsLeft = MATCH_DEADLINE_SEC - elapsed
  const showHeartPrompt = elapsed >= HEART_PROMPT_SEC && !bothLiked
  const likeLocked = elapsed < LIKE_UNLOCK_SEC

  return (
    <div className="mx-auto flex h-svh w-full max-w-lg flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setShowLeaveConfirm(true)} className="text-zinc-400 hover:text-white">
          ←
        </button>
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm text-white">
          <AvatarImage
            equipped={partner?.equipped}
            fallbackLetter={partner?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="flex-1 font-medium text-white">{partner?.username ?? '…'}</h1>
        {!bothLiked && (
          <span className={`text-xs ${showHeartPrompt ? 'text-pink-400' : 'text-zinc-500'}`}>
            {formatCountdown(secondsLeft)}
          </span>
        )}
      </div>

      {justBecameFriends && (
        <div className="mb-3 rounded-lg bg-pink-950/40 px-3 py-2 text-center text-sm text-pink-300">
          🎉 You two liked each other. You're friends now!
        </div>
      )}

      {bothReady && !bothLiked && showHeartPrompt && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-pink-800/50 bg-pink-950/30 px-3 py-2 text-sm">
          <span className="text-zinc-200">
            {partnerLiked
              ? `${partner?.username} liked you! Like back to keep chatting.`
              : iLiked
                ? 'Waiting for them to like back…'
                : 'Like each other to keep the conversation going.'}
          </span>
          <button
            onClick={handleLike}
            disabled={likeBusy || iLiked || likeLocked}
            className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {iLiked ? '❤️ Liked' : '🤍 Like'}
          </button>
        </div>
      )}

      {bothReady && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={handleNext}
            className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Next
          </button>
          {!bothLiked && !showHeartPrompt && (
            <button
              onClick={handleLike}
              disabled={likeBusy || iLiked || likeLocked}
              title={likeLocked ? 'You can like each other after the first minute and a half' : undefined}
              className="flex-1 rounded-lg border border-pink-700 px-3 py-1.5 text-sm text-pink-400 disabled:opacity-50"
            >
              {iLiked ? '❤️ Liked' : likeLocked ? `🤍 Like (${formatCountdown(LIKE_UNLOCK_SEC - elapsed)})` : '🤍 Like'}
            </button>
          )}
          <button
            onClick={handleBlock}
            disabled={blockBusy}
            className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
          >
            🚫 Block
          </button>
          <button
            onClick={() => setReporting(true)}
            className="flex-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            🚩 Report
          </button>
        </div>
      )}
      {reportDone && <p className="mb-2 text-center text-xs text-emerald-400">Report submitted.</p>}
      {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-xs rounded-2xl bg-zinc-900 p-4 text-center">
            <p className="mb-4 text-sm text-white">
              Are you sure you wanna go back and leave the conversation?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
              >
                Stay
              </button>
              <button
                onClick={leaveToHome}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {reporting && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-xs rounded-2xl bg-zinc-900 p-4">
            <p className="mb-3 text-sm text-white">Why are you reporting {partner?.username}?</p>
            <div className="flex flex-col gap-1">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReportReason(r)}
                  className={`rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-800 ${
                    reportReason === r ? 'text-purple-400' : 'text-zinc-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setReporting(false)}
                disabled={reportBusy}
                className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={!reportReason || reportBusy}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {reportBusy ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!bothReady ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-zinc-800 p-6 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-purple-500" />
          <p className="text-sm text-zinc-400">
            Connecting you with {partner?.username ?? 'them'}…
          </p>
          <p className="text-xs text-zinc-600">
            You: {(iAmA ? ready.ready_a : ready.ready_b) ? 'ready ✅' : 'connecting…'} ·{' '}
            {partner?.username ?? 'They'}: {(iAmA ? ready.ready_b : ready.ready_a) ? 'ready ✅' : 'connecting…'}
          </p>
          {elapsed >= 8 && (
            <button
              onClick={retryReady}
              disabled={retryingReady}
              className="rounded-full border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
            >
              {retryingReady ? 'Retrying…' : 'Taking a while, tap to retry'}
            </button>
          )}
        </div>
      ) : session?.mode === 'voice' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-zinc-800 p-6">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
            <AvatarImage
              equipped={partner?.equipped}
              fallbackLetter={partner?.username[0]?.toUpperCase() ?? '?'}
              className="h-full w-full object-contain"
            />
          </div>
          <p className="text-sm text-zinc-400">
            {voiceStatus === 'connecting' && 'Connecting…'}
            {voiceStatus === 'connected' && '🎙️ Voice connected'}
            {voiceStatus === 'error' && (voiceError ?? 'Voice connection failed')}
          </p>
          <button
            onClick={toggleMute}
            disabled={voiceStatus !== 'connected'}
            className={`rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50 ${
              isMuted ? 'bg-red-600 text-white' : 'border border-zinc-700 text-zinc-300'
            }`}
          >
            {isMuted ? '🔇 Unmute' : '🎤 Mute'}
          </button>
          <div ref={audioContainerRef} />
        </div>
      ) : (
        <>
          <p className="mb-2 text-center text-xs text-zinc-500">
            Say Hi and remember to keep it clean 🙂
          </p>
          <div className="flex-1 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-3">
            {messages.length === 0 && <p className="text-center text-sm text-zinc-500">Say hi 👋</p>}
            {messages.map((m) => (
              <div key={m.id} className={m.sender_id === userId ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                    m.sender_id === userId ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  {m.body}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSend} className="mt-2 flex gap-2">
            <input
              type="text"
              maxLength={1000}
              placeholder="Message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-transform active:scale-95"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  )
}
