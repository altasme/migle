export type LyricLine = { time: number; text: string }

// Parses standard LRC format ([mm:ss.xx]text per line). Returns null if no
// line matches - callers treat that as "plain text, no sync" rather than
// an error, since not everyone will paste properly timestamped lyrics.
export function parseLrc(raw: string): LyricLine[] | null {
  const lines: LyricLine[] = []
  const pattern = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/

  for (const rawLine of raw.split('\n')) {
    const match = rawLine.match(pattern)
    if (!match) continue
    const minutes = Number(match[1])
    const seconds = Number(match[2])
    const text = match[3].trim()
    if (text) lines.push({ time: minutes * 60 + seconds, text })
  }

  if (lines.length === 0) return null
  return lines.sort((a, b) => a.time - b.time)
}
