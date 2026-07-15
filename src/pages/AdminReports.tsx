import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

type ReportRow = {
  id: number
  reporter_id: string
  reported_id: string
  room_id: string | null
  reason: string | null
  status: string
  occurred_at: string
}

type ReportDisplay = ReportRow & {
  reporterUsername: string
  reportedUsername: string
}

export function AdminReports() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const [reports, setReports] = useState<ReportDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    if (profile && !profile.is_admin) return
    load()
  }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('reports')
      .select('id, reporter_id, reported_id, room_id, reason, status, occurred_at')
      .order('occurred_at', { ascending: false })
    const rows = (data ?? []) as ReportRow[]
    if (rows.length === 0) {
      setReports([])
      setLoading(false)
      return
    }
    const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]))]
    const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids)
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.username]))
    setReports(
      rows.map((r) => ({
        ...r,
        reporterUsername: nameMap.get(r.reporter_id) ?? '?',
        reportedUsername: nameMap.get(r.reported_id) ?? '?',
      })),
    )
    setLoading(false)
  }

  async function resolve(id: number) {
    setBusy(id)
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', id)
    await load()
    setBusy(null)
  }

  if (profile && !profile.is_admin) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Not authorized.</p>
        <button onClick={() => navigate('/')} className="mt-2 text-purple-400 hover:underline">
          Back home
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white">
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-white">Reports</h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-zinc-500">No reports.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-3 text-sm ${
                r.status === 'resolved'
                  ? 'border-zinc-800 bg-zinc-900/30 opacity-60'
                  : 'border-red-900/50 bg-red-950/20'
              }`}
            >
              <p className="text-white">
                {r.reporterUsername} reported <span className="font-medium">{r.reportedUsername}</span>
              </p>
              <p className="text-xs text-zinc-400">Reason: {r.reason ?? '—'}</p>
              <p className="text-xs text-zinc-500">
                {new Date(r.occurred_at).toLocaleString()} · {r.room_id ? 'in a room' : 'in a DM'} ·{' '}
                {r.status}
              </p>
              {r.status !== 'resolved' && (
                <button
                  onClick={() => resolve(r.id)}
                  disabled={busy === r.id}
                  className="mt-2 rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 disabled:opacity-50"
                >
                  {busy === r.id ? 'Resolving…' : 'Mark resolved'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
