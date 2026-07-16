import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { blockUser, reportUser } from '../lib/safety'
import {
  requestMatch,
  endMatch,
  getSessionStatus,
  fetchMatchMessages,
  sendMatchMessage,
  type MatchSession,
  type MatchMessage,
} from '../lib/match'

type Phase = 'select' | 'waiting' | 'matched' | 'partner-left'
type Partner = { id: string; username: string; equipped: Record<string, string> }

const WAITING_POLL_MS = 2500
const STATUS_POLL_MS = 3000
const MESSAGE_POLL_MS = 3000
const REPORT_REASONS = ['Harassment', 'Underage', 'Spam', 'Inappropriate content', 'Other']

export function VibeMatch() {
  const navigate = useNavigate()
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
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // Tracked for the unmount cleanup below — a plain effect dependency
  // would fire cleanup on every phase change, not just on leaving the page.
  const stateRef = useRef({ phase, session })
  stateRef.current = { phase, session }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

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

  async function startSearching() {
    setError(null)
    setPhase('waiting')
    try {
      const found = await requestMatch('text')
      if (found) {
        setSession(found)
        await loadPartner(found)
        setPhase('matched')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('select')
    }
  }

  // While waiting, keep asking to be matched — request_match() is also
  // how we discover that someone else just matched with us.
  useEffect(() => {
    if (phase !== 'waiting') return
    const id = setInterval(async () => {
      try {
        const found = await requestMatch('text')
        if (found) {
          setSession(found)
          await loadPartner(found)
          setPhase('matched')
        }
      } catch {
        // Transient errors just get retried on the next tick.
      }
    }, WAITING_POLL_MS)
    return () => clearInterval(id)
  }, [phase, userId])

  // While matched, watch for the partner ending the session from their
  // side (Next, block, or leaving) — request_match() alone wouldn't
  // surface that until we called it again ourselves.
  useEffect(() => {
    if (phase !== 'matched' || !session) return
    const id = setInterval(async () => {
      const endedAt = await getSessionStatus(session.id)
      if (endedAt) {
        setPhase('partner-left')
      }
    }, STATUS_POLL_MS)
    return () => clearInterval(id)
  }, [phase, session])

  // Auto-resume searching a moment after the partner leaves.
  useEffect(() => {
    if (phase !== 'partner-left') return
    const id = setTimeout(() => startSearching(), 1500)
    return () => clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'matched' || !session) return
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
      <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-6 p-6 text-center">
        <button onClick={() => navigate('/')} className="self-start text-sm text-zinc-400 hover:text-white">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-white">VibeMatch</h1>
          <p className="mt-1 text-sm text-zinc-400">Meet someone new, right now.</p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={startSearching}
            className="rounded-full bg-purple-600 px-4 py-3 font-semibold text-white"
          >
            💬 Text
          </button>
          <button
            disabled
            title="Voice — coming soon"
            className="rounded-full border border-zinc-700 px-4 py-3 font-semibold text-zinc-500"
          >
            🎙️ Voice — coming soon
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'waiting' || phase === 'partner-left') {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-purple-500" />
        <p className="text-white">{phase === 'partner-left' ? 'They left. Finding someone new…' : 'Looking for someone…'}</p>
        <button
          onClick={() => {
            if (userId) supabase.from('match_queue').delete().eq('user_id', userId)
            setPhase('select')
          }}
          className="text-sm text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-svh w-full max-w-lg flex-col p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm text-white">
          <AvatarImage
            equipped={partner?.equipped}
            fallbackLetter={partner?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="flex-1 font-medium text-white">{partner?.username ?? '…'}</h1>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={handleNext}
          className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Next
        </button>
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
      {reportDone && <p className="mb-2 text-center text-xs text-emerald-400">Report submitted.</p>}
      {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}

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
        <button type="submit" className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white">
          Send
        </button>
      </form>
    </div>
  )
}
