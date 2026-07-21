// Literal gradient strings (not built from concatenated fragments) so
// Tailwind's static scanner picks them all up regardless of which one a
// given room ends up using.
export const ROOM_THEMES = [
  { id: 'purple', label: 'Purple', gradient: 'from-purple-600 to-pink-600' },
  { id: 'pink', label: 'Pink', gradient: 'from-pink-600 to-rose-500' },
  { id: 'blue', label: 'Blue', gradient: 'from-blue-600 to-cyan-500' },
  { id: 'green', label: 'Green', gradient: 'from-emerald-600 to-teal-500' },
  { id: 'orange', label: 'Orange', gradient: 'from-orange-500 to-amber-500' },
] as const

export type RoomThemeId = (typeof ROOM_THEMES)[number]['id']

export function getRoomThemeGradient(theme: string | null | undefined): string {
  return ROOM_THEMES.find((t) => t.id === theme)?.gradient ?? ROOM_THEMES[0].gradient
}
