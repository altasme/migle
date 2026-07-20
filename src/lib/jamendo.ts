// Jamendo hosts Creative Commons / free-to-stream music with a public
// client_id meant for direct browser use (unlike a real secret, it's
// designed to travel in the request URL - Jamendo's own docs show it used
// exactly this way client-side). We never touch the client_secret; that's
// only needed for OAuth flows, which this doesn't use.
const JAMENDO_CLIENT_ID = import.meta.env.VITE_JAMENDO_CLIENT_ID as string | undefined

export type JamendoTrack = {
  id: string
  name: string
  artist_name: string
  audio: string
  duration: number
}

export const JAMENDO_CATEGORIES = [
  { label: 'Cafe', tag: 'lounge' },
  { label: 'Jazz', tag: 'jazz' },
  { label: 'Party', tag: 'party' },
  { label: 'Disco', tag: 'disco' },
  { label: 'Electronic', tag: 'electronic' },
  { label: 'Rock', tag: 'rock' },
] as const

export async function searchJamendoTracks(query: string): Promise<JamendoTrack[]> {
  if (!JAMENDO_CLIENT_ID) throw new Error('Cloud music is not configured.')
  if (!query.trim()) return []

  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    limit: '20',
    namesearch: query.trim(),
    audioformat: 'mp32',
  })

  const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`)
  if (!res.ok) throw new Error('Search failed. Try again.')
  const data = await res.json()
  return (data.results ?? []) as JamendoTrack[]
}

async function fetchJamendoTracksWith(extra: Record<string, string>): Promise<JamendoTrack[]> {
  if (!JAMENDO_CLIENT_ID) throw new Error('Cloud music is not configured.')
  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    limit: '30',
    audioformat: 'mp32',
    ...extra,
  })
  const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []) as JamendoTrack[]
}

// A random handful from a genre/mood tag, for one-tap category presets
// rather than making someone type a search first. Jamendo's `tags` filter
// only matches its own controlled vocabulary exactly, so a guessed tag
// (e.g. "lounge" for a Cafe preset) can come back empty even though it's
// a reasonable genre word. Falls back to a looser tag match, then to a
// plain name search on the category label, so a category is very unlikely
// to ever show up blank.
export async function fetchJamendoByTag(tag: string, fallbackQuery: string, count = 5): Promise<JamendoTrack[]> {
  let all = await fetchJamendoTracksWith({ tags: tag })
  if (all.length === 0) all = await fetchJamendoTracksWith({ fuzzytags: tag })
  if (all.length === 0) all = await fetchJamendoTracksWith({ namesearch: fallbackQuery })

  const shuffled = [...all].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
