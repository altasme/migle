// Fun Karaoke Scoring - rewards participation, not singing accuracy.
// No pitch detection, no ML: this is entirely mic-activity + LiveKit
// audioLevel sampled locally on the singer's own device.
//
// Timing is meant to reward singing during a song's actual vocal
// sections, but we have no per-song lyrics/section timing data (arbitrary
// YouTube search results, no lyrics database). Until that data exists,
// Timing uses the same whole-song activity ratio as Participation - kept
// as a separate field so the weighting/UI matches the spec, and easy to
// make genuinely distinct later if we ever get per-song section data.

export const KARAOKE_SAMPLE_MS = 200
export const KARAOKE_ACTIVE_THRESHOLD = 0.02 // LiveKit audioLevel (0-1) counted as "singing"
export const KARAOKE_ENERGY_REFERENCE = 0.3 // audioLevel treated as "loud" -> energy 100
const KARAOKE_BUCKETS = 10 // time buckets across the song, for consistency

export type KaraokeAccumulator = {
  samples: number
  activeSamples: number
  energySum: number
  bucketActive: number[]
  bucketTotal: number[]
}

export function createKaraokeAccumulator(): KaraokeAccumulator {
  return {
    samples: 0,
    activeSamples: 0,
    energySum: 0,
    bucketActive: Array(KARAOKE_BUCKETS).fill(0),
    bucketTotal: Array(KARAOKE_BUCKETS).fill(0),
  }
}

// progressRatio: 0-1 position through the song (currentTime / duration).
export function sampleKaraoke(acc: KaraokeAccumulator, audioLevel: number, progressRatio: number) {
  acc.samples++
  const bucket = Math.min(KARAOKE_BUCKETS - 1, Math.max(0, Math.floor(progressRatio * KARAOKE_BUCKETS)))
  acc.bucketTotal[bucket]++
  if (audioLevel > KARAOKE_ACTIVE_THRESHOLD) {
    acc.activeSamples++
    acc.energySum += audioLevel
    acc.bucketActive[bucket]++
  }
}

export type KaraokeScoreResult = {
  timing: number
  participation: number
  energy: number
  consistency: number
  finalScore: number
  stars: number
  neverMuted: boolean
}

export function finalizeKaraokeScore(acc: KaraokeAccumulator, neverMuted: boolean): KaraokeScoreResult | null {
  if (acc.samples === 0) return null

  const participation = clampPct(acc.activeSamples / acc.samples)
  const timing = participation

  const avgEnergy = acc.activeSamples > 0 ? acc.energySum / acc.activeSamples : 0
  const energy = clampPct(avgEnergy / KARAOKE_ENERGY_REFERENCE)

  const bucketRatios: number[] = []
  for (let i = 0; i < KARAOKE_BUCKETS; i++) {
    if (acc.bucketTotal[i] > 0) bucketRatios.push(acc.bucketActive[i] / acc.bucketTotal[i])
  }
  const mean = bucketRatios.length ? average(bucketRatios) : 0
  const variance = bucketRatios.length ? average(bucketRatios.map((r) => (r - mean) ** 2)) : 0
  const consistency = clampPct(1 - Math.sqrt(variance))

  const finalScore = Math.round(timing * 0.35 + participation * 0.25 + energy * 0.2 + consistency * 0.2)
  const stars = Math.min(5, Math.max(1, Math.round(finalScore / 20)))

  return {
    timing: Math.round(timing),
    participation: Math.round(participation),
    energy: Math.round(energy),
    consistency: Math.round(consistency),
    finalScore,
    stars,
    neverMuted,
  }
}

export const KARAOKE_REACTION_EMOJIS = ['❤️', '👏', '🔥', '🎉', '😂'] as const
export type KaraokeReactionEmoji = (typeof KARAOKE_REACTION_EMOJIS)[number]

export type KaraokePerformer = {
  userId: string
  username: string
  score: KaraokeScoreResult
}

export type KaraokeAchievements = {
  crowdFavoriteIds: Set<string>
  comedyAwardIds: Set<string>
}

// Crowd Favorite / Comedy Award are comparative across everyone who sang
// this song, so they're derived once at render time from the room's
// reaction tally rather than computed by each performer alone.
export function computeKaraokeAchievements(
  performers: KaraokePerformer[],
  reactionCounts: Record<string, Record<string, number>>,
): KaraokeAchievements {
  const totals = performers.map((p) => {
    const counts = reactionCounts[p.userId] ?? {}
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const laughs = counts['😂'] ?? 0
    return { userId: p.userId, total, laughs }
  })
  const maxTotal = Math.max(0, ...totals.map((t) => t.total))
  const maxLaughs = Math.max(0, ...totals.map((t) => t.laughs))
  return {
    crowdFavoriteIds: new Set(maxTotal > 0 ? totals.filter((t) => t.total === maxTotal).map((t) => t.userId) : []),
    comedyAwardIds: new Set(maxLaughs > 0 ? totals.filter((t) => t.laughs === maxLaughs).map((t) => t.userId) : []),
  }
}

function clampPct(ratio: number) {
  return Math.max(0, Math.min(1, ratio)) * 100
}

function average(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length
}
