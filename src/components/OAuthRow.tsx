// Visual-only for now — buttons are disabled until real OAuth credentials
// are wired up per provider. Shows "coming soon" instead of doing nothing
// silently on tap.
function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title={`${label} — coming soon`}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/60 backdrop-blur-sm disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

export function OAuthRow() {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-zinc-500">or continue with</p>
      <div className="flex items-center gap-3">
        <IconButton label="Google">
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path
              fill="currentColor"
              d="M21.6 12.23c0-.68-.06-1.32-.17-1.94H12v3.9h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.49z"
            />
            <path
              fill="currentColor"
              d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.6-4.11H3.05v2.58A10 10 0 0 0 12 22z"
            />
            <path
              fill="currentColor"
              d="M6.4 13.92a5.99 5.99 0 0 1 0-3.84V7.5H3.05a10 10 0 0 0 0 9l3.35-2.58z"
            />
            <path
              fill="currentColor"
              d="M12 5.98c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.96 9.96 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.35 2.58c.8-2.36 3-4.1 5.6-4.1z"
            />
          </svg>
        </IconButton>
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
