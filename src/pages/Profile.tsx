import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { getFriendCount } from '../lib/friends'
import { ECONOMY_ENABLED } from '../lib/featureFlags'
import { INTEREST_OPTIONS } from '../lib/tags'

const BIO_MAX = 255

type ActiveRelationship = {
  partnerUsername: string
  cp_score: number
  streak_days: number
}

function InterestChip({ label, selected, onClick }: { label: string; selected: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        selected
          ? 'border-purple-500 bg-purple-600 text-white'
          : 'border-zinc-700 bg-zinc-900 text-zinc-400'
      } ${onClick ? '' : 'disabled:opacity-100'}`}
    >
      {label}
    </button>
  )
}

export function Profile() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [relationship, setRelationship] = useState<ActiveRelationship | null>(null)
  const [friendCount, setFriendCount] = useState(0)
  const [editing, setEditing] = useState(false)
  const [bioInput, setBioInput] = useState('')
  const [interestsInput, setInterestsInput] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return
    getFriendCount(uid).then(setFriendCount)
  }, [session?.user.id])

  function startEditing() {
    setBioInput(profile?.bio ?? '')
    setInterestsInput(profile?.interests ?? [])
    setEditing(true)
  }

  function toggleInterest(value: string) {
    setInterestsInput((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  async function saveProfile() {
    const uid = session?.user.id
    if (!uid) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ bio: bioInput.trim() || null, interests: interestsInput })
      .eq('id', uid)
    await refreshProfile()
    setSaving(false)
    setEditing(false)
  }

  useEffect(() => {
    const uid = session?.user.id
    if (!uid) return

    async function refresh() {
      const { data } = await supabase
        .from('relationships')
        .select('user_a, user_b, cp_score, streak_days')
        .eq('status', 'active')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .maybeSingle()
      if (!data) {
        setRelationship(null)
        return
      }
      const partnerId = data.user_a === uid ? data.user_b : data.user_a
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', partnerId)
        .maybeSingle()
      setRelationship({
        partnerUsername: prof?.username ?? '?',
        cp_score: data.cp_score,
        streak_days: data.streak_days,
      })
    }

    refresh()
    // Partner could end things from their side while we're just sitting
    // on this page — poll so it doesn't go stale.
    const pollId = setInterval(refresh, 5000)
    return () => clearInterval(pollId)
  }, [session?.user.id])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-700 to-pink-700 text-2xl font-semibold text-white ring-4 ring-purple-600/20">
          <AvatarImage
            equipped={profile?.equipped}
            fallbackLetter={profile?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
          />
        </span>
        <h1 className="text-2xl font-bold text-white">{profile?.username}</h1>
        <Link
          to="/friends"
          className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-1.5 text-sm"
        >
          <span className="font-semibold text-white">{friendCount}</span>
          <span className="text-zinc-400">Friends</span>
        </Link>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div>
            <textarea
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value.slice(0, BIO_MAX))}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="Tell people a little about yourself…"
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-zinc-600">
              {bioInput.length}/{BIO_MAX}
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Interests</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => (
                <InterestChip
                  key={opt}
                  label={opt}
                  selected={interestsInput.includes(opt)}
                  onClick={() => toggleInterest(opt)}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm text-zinc-300">
            {profile?.bio || <span className="text-zinc-600">No bio yet.</span>}
          </p>
          {profile && profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((i) => (
                <InterestChip key={i} label={i} selected />
              ))}
            </div>
          )}
          <button onClick={startEditing} className="self-start text-xs font-medium text-purple-400 hover:underline">
            Edit bio & interests
          </button>
        </div>
      )}

      {ECONOMY_ENABLED && relationship && (
        <div className="rounded-xl border border-pink-900/50 bg-pink-950/30 px-4 py-3 text-center text-sm">
          <p className="text-pink-400">💍 Partnered with {relationship.partnerUsername}</p>
          <p className="text-xs text-zinc-400">
            CP {relationship.cp_score} · {relationship.streak_days} day streak
          </p>
        </div>
      )}

      <Link
        to="/wardrobe"
        className="rounded-xl bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98]"
      >
        🎨 Edit avatar
      </Link>

      <div className="flex flex-col divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <Link to="/blocked" className="px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white">
          🚫 Blocked users
        </Link>
        {profile?.is_admin && (
          <Link
            to="/admin/reports"
            className="px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
          >
            🛡️ Reports (admin)
          </Link>
        )}
      </div>

      <button
        onClick={signOut}
        className="rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-400 hover:text-white"
      >
        Log out
      </button>
    </div>
  )
}
