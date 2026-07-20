// Pasted URL, not search - a search box would need the YouTube Data API
// (a separate credential this app doesn't have), and pasting a link needs
// nothing beyond the public IFrame Player API already used for playback.
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
