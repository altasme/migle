import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAssetUrl } from '../../lib/compositor'
import { useAuthStore } from '../../store/authStore'
import { AvatarImage } from '../AvatarImage'
import { ECONOMY_ENABLED } from '../../lib/featureFlags'
import { OnboardingChrome } from './OnboardingChrome'

type ShopItem = { id: string; name: string; asset_path: string; price_coins: number | null }
type Gender = 'male' | 'female'

function styleOf(id: string) {
  return id.replace(/_\d+$/, '')
}

// Gender lives entirely in the style id prefix (av_male_/av_female_) -
// no separate column needed, same reasoning as deriving style from id.
function genderOf(style: string): Gender {
  return style.startsWith('av_female_') ? 'female' : 'male'
}

const STYLE_LABELS: Record<string, string> = {
  av_male_hoodie: 'Street',
  av_male_dark: 'Shadow',
  av_female_pink: 'Sakura',
}

// This IS the fun part - people get attached to their character. Reuses
// the same full-body-look model as Wardrobe (one 'body' item = the whole
// avatar), just framed as an exciting first choice instead of a shop.
export function AvatarStep({ onNext }: { onNext: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [items, setItems] = useState<ShopItem[]>([])
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [gender, setGender] = useState<Gender>('male')
  const [activeStyle, setActiveStyle] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const userId = profile?.id
      if (!userId) return
      const [itemsRes, invRes] = await Promise.all([
        supabase.from('cosmetic_items').select('id, name, asset_path, price_coins').eq('slot', 'body').eq('is_active', true).order('id'),
        supabase.from('user_inventory').select('item_id').eq('user_id', userId),
      ])
      const data = itemsRes.data ?? []
      setItems(data)
      setOwned(new Set((invRes.data ?? []).map((r) => r.item_id)))
      const pool = ECONOMY_ENABLED ? data : data.filter((i) => i.price_coins === 0)
      const firstMale = pool.find((i) => genderOf(styleOf(i.id)) === 'male')
      const first = firstMale ?? pool[0]
      if (first) {
        setActiveStyle(styleOf(first.id))
        setSelectedId(first.id)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const visibleItems = ECONOMY_ENABLED ? items : items.filter((i) => i.price_coins === 0 || owned.has(i.id))
  const stylesForGender = [...new Set(visibleItems.map((i) => styleOf(i.id)))].filter((s) => genderOf(s) === gender)
  const variants = visibleItems.filter((i) => styleOf(i.id) === activeStyle)
  const selected = items.find((i) => i.id === selectedId)

  function pickGender(next: Gender) {
    setGender(next)
    const style = stylesForGenderFor(next)
    if (style) {
      setActiveStyle(style)
      const firstVariant = visibleItems.find((i) => styleOf(i.id) === style)
      if (firstVariant) setSelectedId(firstVariant.id)
    }
  }

  function stylesForGenderFor(g: Gender) {
    return [...new Set(visibleItems.map((i) => styleOf(i.id)))].find((s) => genderOf(s) === g)
  }

  async function handleContinue() {
    if (!selectedId) return
    setBusy(true)
    setError(null)
    try {
      if (!owned.has(selectedId)) {
        const { error } = await supabase.rpc('buy_cosmetic', { p_item_id: selectedId })
        if (error) throw error
      }
      const { error } = await supabase.rpc('equip', { p_equipped: { body: selectedId } })
      if (error) throw error
      await refreshProfile()
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingChrome
      step={1}
      totalSteps={6}
      title="Meet your character 🎨"
      subtitle="This is you in the Mingleverse. Pick a look you vibe with. You can always change it later."
      onContinue={handleContinue}
      continueDisabled={!selectedId}
      busy={busy}
    >
      <div className="flex flex-col gap-5">
        <div className="flex justify-center">
          <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/40 to-pink-900/40 ring-2 ring-purple-500/40">
            <AvatarImage
              equipped={selected ? { body: selected.id } : {}}
              fallbackLetter={profile?.username[0]?.toUpperCase() ?? '?'}
              className="h-full w-full object-contain"
              variant="full"
            />
          </div>
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <div className="flex justify-center gap-2">
          {(['male', 'female'] as const).map((g) => (
            <button
              key={g}
              onClick={() => pickGender(g)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                gender === g ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'border border-zinc-700 text-zinc-400'
              }`}
            >
              {g === 'male' ? '♂ Male' : '♀ Female'}
            </button>
          ))}
        </div>

        {stylesForGender.length > 1 && (
          <div className="flex justify-center gap-2">
            {stylesForGender.map((style) => (
              <button
                key={style}
                onClick={() => {
                  setActiveStyle(style)
                  const firstVariant = visibleItems.find((i) => styleOf(i.id) === style)
                  if (firstVariant) setSelectedId(firstVariant.id)
                }}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  activeStyle === style ? 'border-purple-500 bg-purple-600/20 text-white' : 'border-zinc-800 text-zinc-400'
                }`}
              >
                {STYLE_LABELS[style] ?? style}
              </button>
            ))}
          </div>
        )}

        {stylesForGender.length === 0 && (
          <p className="text-center text-sm text-zinc-500">No looks available for this yet. Check back soon!</p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {variants.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 bg-zinc-900 transition-transform active:scale-95 ${
                selectedId === item.id ? 'border-purple-500' : 'border-zinc-800'
              }`}
            >
              <img
                src={getAssetUrl(item.asset_path)}
                alt={item.name}
                className="h-full w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </button>
          ))}
        </div>
      </div>
    </OnboardingChrome>
  )
}
