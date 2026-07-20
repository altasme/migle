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
