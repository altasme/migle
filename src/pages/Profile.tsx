import { useAuthStore } from '../store/authStore'

export function Profile() {
  const profile = useAuthStore((s) => s.profile)
  const session = useAuthStore((s) => s.session)
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-900 text-2xl font-semibold text-white">
        {profile?.username[0]?.toUpperCase()}
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white">@{profile?.username}</h1>
        <p className="text-sm text-zinc-500">{session?.user.email}</p>
      </div>
      <button
        onClick={signOut}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:text-white"
      >
        Log out
      </button>
    </div>
  )
}
