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

  function close() {
    setOpen(false)
    setReporting(false)
    setReason('')
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true)
          setDone(null)
        }}
        className="text-zinc-400 hover:text-white"
      >
        ⋯
      </button>

      {open && (
        // A small anchored dropdown here used to get clipped/pushed off
        // screen depending on where the "..." trigger sits (e.g. the
        // left column of a seat grid) - a centered modal, same pattern
        // as the other overlays in this app, is never at the mercy of
        // where the trigger happens to be on screen.
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60" onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-900 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="px-1 text-sm font-medium text-white">{targetUsername}</p>
              <button onClick={close} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            {done && <p className="mb-2 px-1 text-xs text-emerald-400">{done}</p>}
            {error && <p className="mb-2 px-1 text-xs text-red-400">{error}</p>}

            {!reporting ? (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setReporting(true)}
                  className="rounded-lg px-2 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  🚩 Report {targetUsername}
                </button>
                <button
                  onClick={toggleBlock}
                  disabled={busy}
                  className="rounded-lg px-2 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {blocked ? `Unblock @${targetUsername}` : `🚫 Block @${targetUsername}`}
                </button>
                {ownerControls && (
                  <>
                    <div className="my-1 border-t border-zinc-800" />
                    <button
                      onClick={() => ownerControls.onMute(!ownerControls.isMuted)}
                      className="rounded-lg px-2 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                    >
                      {ownerControls.isMuted ? 'Unmute' : '🔇 Mute'}
                    </button>
                    <button
                      onClick={ownerControls.onKick}
                      className="rounded-lg px-2 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
                    >
                      ⛔ Kick from room
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
                    className={`rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-800 ${
                      reason === r ? 'text-purple-400' : 'text-zinc-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <div className="mt-1 flex gap-2 px-2">
                  <button
                    onClick={() => setReporting(false)}
                    className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={!reason || busy}
                    className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
