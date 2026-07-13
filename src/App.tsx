import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { AuthForm } from './components/AuthForm'
import { UsernameClaim } from './components/UsernameClaim'

function Home() {
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold text-white">Welcome, @{profile?.username}</h1>
      <p className="text-sm text-zinc-400">You're signed in and your profile is set up.</p>
      <button
        type="button"
        onClick={signOut}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:text-white"
      >
        Log out
      </button>
    </div>
  )
}

function App() {
  const { session, profile, loading, init } = useAuthStore()

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-950">
      {!session ? <AuthForm /> : !profile ? <UsernameClaim /> : <Home />}
    </div>
  )
}

export default App
