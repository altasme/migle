// Fixed tag lists for profile onboarding + display. Data lives on
// profiles.interests / profiles.personality_traits as plain text[] — no
// lookup table needed for a fixed, curated set like this. Emoji are kept as
// a separate display-time lookup (EMOJI_BY_LABEL) rather than baked into
// the stored string, so the icon can change later without touching data
// already saved for real users.
export const INTEREST_OPTIONS = [
  'Gaming',
  'Karaoke',
  'Movies & TV',
  'Food',
  'Travel',
  'Photography',
  'Pets',
  'Books',
  'Tech',
  'Music',
  'Art',
  'Dancing',
  'Fitness',
  'Sports',
  'Fashion',
  'Cooking',
  'Anime',
  'K-pop',
  'Puzzles & Games',
  'Nature',
]
export const MAX_INTERESTS = 5

export const PERSONALITY_OPTIONS = [
  'Friendly',
  'Funny',
  'Nerdy',
  'Gamer',
  'Chill',
  'Talkative',
  'Night Owl',
  'Soft-hearted',
  'Adventurous',
  'Curious',
  'Music Lover',
  'Foodie',
  'Ambitious',
  'Creative',
  'Good Listener',
]
export const MAX_PERSONALITY = 3

export const PROMPT_OPTIONS = [
  'A perfect day is...',
  'My biggest pet peeve is...',
  'If we become friends...',
  'My dream superpower would be...',
  'My comfort food...',
  'The fastest way to be my friend...',
  "I'm secretly good at...",
  'My ideal weekend...',
  "You'll never guess that I...",
  'The way to my heart is...',
]
export const PROMPT_COUNT = 3
export const PROMPT_ANSWER_MAX = 140

export const EMOJI_BY_LABEL: Record<string, string> = {
  // Interests
  Gaming: '🎮',
  Karaoke: '🎤',
  'Movies & TV': '🎬',
  Food: '🍜',
  Travel: '✈️',
  Photography: '📷',
  Pets: '🐶',
  Books: '📚',
  Tech: '💻',
  Music: '🎵',
  Art: '🎨',
  Dancing: '💃',
  Fitness: '🏋️',
  Sports: '⚽',
  Fashion: '👗',
  Cooking: '🍳',
  Anime: '🌸',
  'K-pop': '🎧',
  'Puzzles & Games': '🧩',
  Nature: '🌿',
  // Personality (some labels overlap with interests above on purpose -
  // same word, same icon, one shared lookup)
  Friendly: '😊',
  Funny: '😂',
  Nerdy: '🤓',
  Gamer: '🎮',
  Chill: '☕',
  Talkative: '🎤',
  'Night Owl': '🌙',
  'Soft-hearted': '🌸',
  Adventurous: '🚀',
  Curious: '📚',
  'Music Lover': '🎵',
  Foodie: '🍜',
  Ambitious: '💪',
  Creative: '🎨',
  'Good Listener': '💜',
}

export function emojiFor(label: string): string {
  return EMOJI_BY_LABEL[label] ?? '✨'
}

export type PromptAnswer = { question: string; answer: string }

export const LOOKING_FOR_OPTIONS = [
  'Friends',
  'Game Buddies',
  'Relationship',
  'Chat Buddy',
  'Study Buddy',
  'Networking',
]
