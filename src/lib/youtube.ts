// Separate from the IFrame Player API below: searching needs the YouTube
// Data API v3, which requires its own API key from Google Cloud Console
// (Data API and IFrame playback are unrelated APIs with separate access).
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

export type YouTubeSearchResult = {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
}

export async function searchYouTubeVideos(query: string): Promise<YouTubeSearchResult[]> {
  if (!YOUTUBE_API_KEY) throw new Error('In-app YouTube search is not configured yet.')
  if (!query.trim()) return []

  const params = new URLSearchParams({
    key: YOUTUBE_API_KEY,
    part: 'snippet',
    type: 'video',
    maxResults: '15',
    q: query.trim(),
  })

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`)
  if (!res.ok) throw new Error('Search failed. Try again.')
  const data = await res.json()

  return ((data.items ?? []) as Array<{
    id: { videoId: string }
    snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } }
  }>).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails.default.url,
  }))
}

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

let apiLoadPromise: Promise<void> | null = null

// Loads the YouTube IFrame Player API script once, however many room
// visits/components need it. YT.Player instances can be created as soon
// as this resolves.
export function loadYouTubeIframeApi(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise

  apiLoadPromise = new Promise((resolve) => {
    const w = window as unknown as { YT?: { Player: unknown } }
    if (w.YT?.Player) {
      resolve()
      return
    }
    const existing = document.getElementById('youtube-iframe-api')
    if (!existing) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
    const w2 = window as unknown as { onYouTubeIframeAPIReady?: () => void }
    const prev = w2.onYouTubeIframeAPIReady
    w2.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
  })

  return apiLoadPromise
}
