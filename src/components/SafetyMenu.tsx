import { useEffect, useState } from 'react'
import { blockUser, unblockUser, isBlocked, reportUser } from '../lib/safety'

type OwnerControls = {
  isMuted: boolean
  onMute: (muted: boolean) => void
  onKick: () => void
}

type Props = {
  targetId: string
  targetUsername: string
  roomId?: string
  ownerControls?: OwnerControls
  onBlockChange?: (blocked: boolean) => void
}

const REPORT_REASONS = ['Harassment', 'Underage', 'Spam', 'Inappropriate content', 'Other']

export function SafetyMenu({ targetId, targetUsername, roomId, ownerControls, onBlockChange }: Props) {
  const [open, setOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (open) isBlocked(targetId).then(setBlocked)
  }, [open, targetId])

  async function toggleBlock() {
    setBusy(true)
    setError(null)
    try {
      if (blocked) {
        await unblockUser(targetId)
        setBlocked(false)
      } else {
        await blockUser(targetId)
        setBlocked(true)
      }
      onBlockChange?.(!blocked)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function submitReport() {
    if (!reason) return
    setBusy(true)
    setError(null)
    try {
      await reportUser(targetId, reason, roomId)
      setDone('Report submitted.')
      setReporting(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o)
          setDone(null)
        }}
        className="text-zinc-400 hover:text-white"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-20 w-56 rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-lg">
          {done && <p className="mb-2 text-xs text-emerald-400">{done}</p>}
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

          {!reporting ? (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setReporting(true)}
                className="rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              >
                🚩 Report {targetUsername}
              </button>
              <button
                onClick={toggleBlock}
                disabled={busy}
                className="rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {blocked ? `Unblock @${targetUsername}` : `🚫 Block @${targetUsername}`}
              </button>
              {ownerControls && (
                <>
                  <div className="my-1 border-t border-zinc-800" />
                  <button
                    onClick={() => ownerControls.onMute(!ownerControls.isMuted)}
                    className="rounded px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    {ownerControls.isMuted ? 'Unmute' : '🔇 Mute'} (owner)
                  </button>
                  <button
                    onClick={ownerControls.onKick}
                    className="rounded px-2 py-1.5 text-left text-sm text-red-400 hover:bg-zinc-800"
                  >
                    ⛔ Kick from room (owner)
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="mb-1 px-2 text-xs text-zinc-400">Why are you reporting this user?</p>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-800 ${
                    reason === r ? 'text-purple-400' : 'text-zinc-300'
                  }`}
                >
                  {r}
                </button>
              ))}
              <div className="mt-1 flex gap-2 px-2">
                <button
                  onClick={() => setReporting(false)}
                  className="flex-1 rounded border border-zinc-700 py-1 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  disabled={!reason || busy}
                  className="flex-1 rounded bg-red-600 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
