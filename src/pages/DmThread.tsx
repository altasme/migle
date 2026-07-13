import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'

type ThreadRow = {
  id: string
  user_a: string
  user_b: string
  status: string
  initiator: string
}

type DmMessage = {
  id: number
  sender_id: string
  body: string
  created_at: string
}

export function DmThread() {
  const { threadId } = useParams<{ threadId: string }>()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.session?.user.id)

  const [thread, setThread] = useState<ThreadRow | 'not-found' | null>(null)
  const [other, setOther] = useState<{ username: string; equipped: Record<string, string> } | null>(
    null,
  )
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useEffect(() => {
    if (!threadId || !userId) return
    let active = true

    async function setup() {
      const { data } = await supabase
        .from('dm_threads')
        .select('id, user_a, user_b, status, initiator')
        .eq('id', threadId)
        .maybeSingle()
      if (!active) return
      if (!data) {
        setThread('not-found')
        return
      }
      setThread(data)

      const otherId = data.user_a === userId ? data.user_b : data.user_a
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, equipped')
        .eq('id', otherId)
        .maybeSingle()
      if (!active) return
      setOther(prof)

      const { data: msgs } = await supabase
        .from('dm_messages')
        .select('id, sender_id, body, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(100)
      if (!active) return
      setMessages(msgs ?? [])
    }
    setup()

    const channel = supabase
      .channel(`dm:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as DmMessage
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [threadId, userId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!threadId || !userId || !input.trim() || thread === null || thread === 'not-found') return
    const body = input.trim()
    setInput('')

    const { data, error } = await supabase
      .from('dm_messages')
      .insert({ thread_id: threadId, sender_id: userId, body })
      .select('id, created_at')
      .single()
    if (error || !data) return

    setMessages((prev) =>
      prev.some((m) => m.id === data.id)
        ? prev
        : [...prev, { id: data.id, sender_id: userId, body, created_at: data.created_at }],
    )

    // Replying to a request implicitly accepts it.
    if (thread.status === 'pending' && thread.initiator !== userId) {
      await supabase.from('dm_threads').update({ status: 'accepted' }).eq('id', threadId)
      setThread({ ...thread, status: 'accepted' })
    }
  }

  if (thread === null) {
    return <p className="p-6 text-center text-zinc-400">Loading…</p>
  }
  if (thread === 'not-found') {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Conversation not found.</p>
        <button onClick={() => navigate('/chat')} className="mt-2 text-purple-400 hover:underline">
          Back to chat
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-svh w-full max-w-lg flex-col p-4">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => navigate('/chat')} className="text-zinc-400 hover:text-white">
          ←
        </button>
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm text-white">
          <AvatarImage
            equipped={other?.equipped}
            fallbackLetter={other?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="font-medium text-white">@{other?.username ?? '…'}</h1>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-500">Say hi 👋</p>
        )}
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

      <form onSubmit={sendMessage} className="mt-2 flex gap-2">
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
          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white"
        >
          Send
        </button>
      </form>
    </div>
  )
}
