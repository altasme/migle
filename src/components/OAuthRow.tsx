// Visual-only for now — buttons are disabled until real OAuth credentials
// are wired up per provider. Shows "coming soon" instead of doing nothing
// silently on tap. Google and Facebook are full-width primary buttons on
// AuthLanding instead of here, since they're real, working sign-in paths.
function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title={`${label}: coming soon`}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/60 backdrop-blur-sm disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

export function OAuthRow() {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-zinc-500">more options coming soon</p>
      <div className="flex items-center gap-3">
        <IconButton label="Apple">
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path
              fill="currentColor"
              d="M16.3 2c.1 1.1-.3 2.2-1 3-.7.8-1.9 1.5-3 1.4-.1-1.1.4-2.2 1-3 .8-.8 2-1.4 3-1.4zM19.9 17c-.5 1.1-.8 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9s-2.4.9-3.7.9c-1.6 0-2.8-1.5-3.7-2.9C1.4 17 .8 12.6 2.6 10c1-1.7 2.7-2.8 4.5-2.8 1.5 0 2.4 1 3.7 1s2.1-1 3.7-1c1.6 0 3.3.9 4.3 2.4-3.8 2.1-3.2 7.5.1 7.4z"
            />
          </svg>
        </IconButton>
        <IconButton label="Discord">
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path
              fill="currentColor"
              d="M19.5 5.4A17.6 17.6 0 0 0 15.3 4c-.2.4-.4.9-.6 1.3a16.3 16.3 0 0 0-4.9 0A9 9 0 0 0 9.2 4c-1.4.2-2.8.7-4.2 1.4C2.4 9.3 1.7 13 2 16.7a17.7 17.7 0 0 0 5.4 2.7c.4-.6.8-1.2 1.1-1.9-.6-.2-1.2-.5-1.7-.9l.4-.3c3.4 1.6 7 1.6 10.3 0l.4.3c-.5.4-1.1.7-1.7.9.3.7.7 1.3 1.1 1.9a17.6 17.6 0 0 0 5.4-2.7c.4-4.3-.7-8-2.7-11.3zM9 14.6c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2zm6 0c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2z"
            />
          </svg>
        </IconButton>
      </div>
    </div>
  )
}
