import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'

type Row = { id: string; username: string; equipped: Record<string, string> }

export function FollowList({ kind }: { kind: 'followers' | 'following' }) {
  const { userId: routeUserId } = useParams()
  const session = useAuthStore((s) => s.session)
  const userId = routeUserId ?? session?.user.id
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    async function load() {
      const column = kind === 'followers' ? 'following_id' : 'follower_id'
      const otherColumn = kind === 'followers' ? 'follower_id' : 'following_id'
      const { data: links } = await supabase.from('follows').select(otherColumn).eq(column, userId)
      const ids = (links ?? []).map((r: Record<string, string>) => r[otherColumn])
      if (ids.length === 0) {
        setRows([])
        setLoading(false)
        return
      }
      const { data: profs } = await supabase.from('profiles').select('id, username, equipped').in('id', ids)
      setRows((profs ?? []) as Row[])
      setLoading(false)
    }
    load()
  }, [userId, kind])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Link to="/profile" className="text-sm text-zinc-400 hover:text-white">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-white">
          {kind === 'followers' ? 'Followers' : 'Following'}
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">
                <AvatarImage
                  equipped={r.equipped}
                  fallbackLetter={r.username[0]?.toUpperCase() ?? '?'}
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-sm font-medium text-white">{r.username}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
