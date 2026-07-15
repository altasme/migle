import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Row = {
  id: string
  cp_score: number
  streak_days: number
  aUsername: string
  bUsername: string
}

export function Leaderboard() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('relationships')
      .select('id, user_a, user_b, cp_score, streak_days')
      .eq('status', 'active')
      .order('cp_score', { ascending: false })
      .limit(20)
    const rels = data ?? []
    if (rels.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    const ids = [...new Set(rels.flatMap((r) => [r.user_a, r.user_b]))]
    const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids)
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.username]))
    setRows(
      rels.map((r) => ({
        id: r.id,
        cp_score: r.cp_score,
        streak_days: r.streak_days,
        aUsername: nameMap.get(r.user_a) ?? '?',
        bUsername: nameMap.get(r.user_b) ?? '?',
      })),
    )
    setLoading(false)
  }

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white">
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-white">💍 CP Leaderboard</h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No couples yet — be the first to partner up.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
            >
              <span className="text-sm text-zinc-300">
                <span className="mr-2">{medal(i)}</span>
                {r.aUsername} 💕 {r.bUsername}
              </span>
              <span className="text-sm text-pink-400">CP {r.cp_score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
