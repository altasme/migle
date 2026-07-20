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

export type JamendoPlaylist = {
  id: string
  name: string
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

// A random handful from a genre/mood tag, for one-tap category presets
// rather than making someone type a search first.
export async function fetchJamendoByTag(tag: string, count = 5): Promise<JamendoTrack[]> {
  if (!JAMENDO_CLIENT_ID) throw new Error('Cloud music is not configured.')

  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    limit: '30',
    tags: tag,
    audioformat: 'mp32',
  })

  const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to load category. Try again.')
  const data = await res.json()
  const all = (data.results ?? []) as JamendoTrack[]
  const shuffled = [...all].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export async function searchJamendoPlaylists(query: string): Promise<JamendoPlaylist[]> {
  if (!JAMENDO_CLIENT_ID) throw new Error('Cloud music is not configured.')

  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    limit: '20',
    ...(query.trim() ? { namesearch: query.trim() } : { order: 'creationdate_desc' }),
  })

  const res = await fetch(`https://api.jamendo.com/v3.0/playlists/?${params.toString()}`)
  if (!res.ok) throw new Error('Search failed. Try again.')
  const data = await res.json()
  return (data.results ?? []) as JamendoPlaylist[]
}

export async function getJamendoPlaylistTracks(playlistId: string): Promise<JamendoTrack[]> {
  if (!JAMENDO_CLIENT_ID) throw new Error('Cloud music is not configured.')

  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    id: playlistId,
    audioformat: 'mp32',
  })

  const res = await fetch(`https://api.jamendo.com/v3.0/playlists/tracks/?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to load playlist.')
  const data = await res.json()
  const first = (data.results ?? [])[0]
  return (first?.tracks ?? []) as JamendoTrack[]
}
