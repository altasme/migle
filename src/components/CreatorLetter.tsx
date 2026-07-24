import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mingle_seen_creator_letter'

// A one-time welcome note shown the first time the app opens on a device,
// dismissed permanently after that (tracked in localStorage, not the
// profile - this is per-install goodwill copy, not user data worth syncing
// across devices).
export function CreatorLetter() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="page-enter relative flex max-h-[90svh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-purple-800/40 bg-zinc-950 shadow-2xl shadow-purple-950/50">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-lg text-white"
        >
          ✕
        </button>

        <div className="overflow-y-auto p-6 pt-8">
          <div className="mb-4 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-700 to-pink-600 shadow-lg shadow-purple-950/40 ring-2 ring-purple-500/30">
              <img src="/creator-portrait.png" alt="Van, creator of Mingleverse" className="h-full w-full object-cover" />
            </div>
          </div>

          <h1 className="mb-3 text-center text-lg font-bold text-white">💜 A Letter from the Creator</h1>

          <div className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-300">
            <p>Hi, and welcome to Mingleverse.</p>
            <p>Thank you for giving this little project a chance. It truly means the world to me.</p>
            <p>I created Mingleverse with one dream: to build a place where strangers can become genuine friends.</p>
            <p>
              This app is still growing, so you may encounter bugs or unfinished features. I ask for your patience
              as I continue improving it, one update at a time.
            </p>
            <p>
              If Mingleverse ever makes you smile, helps you meet an amazing friend, or makes you feel a little less
              alone, then every late night spent building it has been worth it.
            </p>
            <p>
              Thank you for being part of this journey. I hope you'll help shape the future of Mingleverse with your
              kindness, feedback, and support.
            </p>
            <p>Welcome to the universe. 💜</p>
            <p className="mt-1">
              <span className="font-semibold text-white">Van</span>
              <br />
              <span className="text-zinc-400">Creator of Mingleverse</span>
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-900 p-4">
          <button
            onClick={dismiss}
            className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-lg shadow-purple-950/40 transition-transform active:scale-[0.98]"
          >
            ✨ Let's Start Mingling
          </button>
        </div>
      </div>
    </div>
  )
}
