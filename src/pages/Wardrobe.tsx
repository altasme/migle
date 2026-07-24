import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAssetUrl } from '../lib/compositor'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'
import { ECONOMY_ENABLED } from '../lib/featureFlags'

type ShopItem = {
  id: string
  name: string
  slot: string
  asset_path: string
  price_coins: number | null
}

type Gender = 'male' | 'female'

// Gender lives entirely in the id prefix (av_male_/av_female_) - no
// separate column, and no sub-style grouping either: just two flat grids,
// one per gender.
function genderOf(id: string): Gender {
  return id.startsWith('av_female_') ? 'female' : 'male'
}

export function Wardrobe() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const [items, setItems] = useState<ShopItem[]>([])
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [equipped, setEquipped] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gender, setGender] = useState<Gender>('male')
  const [genderInitialized, setGenderInitialized] = useState(false)

  useEffect(() => {
    setEquipped(profile?.equipped ?? {})
  }, [profile?.equipped])

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (genderInitialized || items.length === 0) return
    if (profile?.gender) {
      setGender(profile.gender)
      setGenderInitialized(true)
      return
    }
    // Legacy account from before gender was tracked - infer it from
    // whatever's currently equipped (or the first available look) and
    // backfill it, so it becomes a locked choice going forward like
    // everyone else's.
    const currentBody = profile?.equipped?.body
    const fallbackPool = ECONOMY_ENABLED ? items : items.filter((i) => i.price_coins === 0 || owned.has(i.id))
    const inferred = currentBody ? genderOf(currentBody) : genderOf(fallbackPool[0]?.id ?? 'av_male_01')
    setGender(inferred)
    setGenderInitialized(true)
    const userId = session?.user.id
    if (userId) {
      supabase
        .from('profiles')
        .update({ gender: inferred })
        .eq('id', userId)
        .then(() => refreshProfile())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, profile?.gender])

  async function load() {
    const userId = session!.user.id
    const [itemsRes, invRes] = await Promise.all([
      supabase
        .from('cosmetic_items')
        .select('id, name, slot, asset_path, price_coins')
        .eq('slot', 'body')
        .eq('is_active', true)
        .order('id'),
      supabase.from('user_inventory').select('item_id').eq('user_id', userId),
    ])
    setItems(itemsRes.data ?? [])
    setOwned(new Set((invRes.data ?? []).map((r) => r.item_id)))
  }

  async function selectItem(item: ShopItem) {
    setError(null)
    setBusy(item.id)
    try {
      if (!owned.has(item.id)) {
        const { error } = await supabase.rpc('buy_cosmetic', { p_item_id: item.id })
        if (error) throw error
        setOwned((prev) => new Set(prev).add(item.id))
      }
      // Full replace, not merge: an old layered look (hair/top/hat from a
      // retired art style) shouldn't linger under a new full-body look.
      const nextEquipped = { body: item.id }
      const { error } = await supabase.rpc('equip', { p_equipped: nextEquipped })
      if (error) throw error
      setEquipped(nextEquipped)
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  // Economy hidden for now: don't offer looks that would silently spend
  // coins with no visible price - only free or already-owned looks show.
  const visibleItems = ECONOMY_ENABLED ? items : items.filter((i) => i.price_coins === 0 || owned.has(i.id))
  const variants = visibleItems.filter((i) => genderOf(i.id) === gender)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white">
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-white">Wardrobe</h1>
      </div>

      <div className="flex justify-center">
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 text-3xl text-white ring-1 ring-zinc-800">
          <AvatarImage
            equipped={equipped}
            fallbackLetter={profile?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
            variant="full"
          />
        </div>
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Gender</h2>
        <span className="inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1.5 text-sm font-medium text-white">
          {gender === 'male' ? '♂ Male' : '♀ Female'}
        </span>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Looks</h2>
        <div className="flex flex-wrap gap-3">
          {variants.map((item) => {
            const isEquipped = equipped.body === item.id
            const isOwned = owned.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                disabled={busy === item.id}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-transform active:scale-95 disabled:opacity-50 ${
                  isEquipped ? 'border-purple-500' : 'border-zinc-800'
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-zinc-900">
                  <img
                    src={getAssetUrl(item.asset_path)}
                    alt={item.name}
                    className="h-full w-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                {!isOwned && (
                  <span className="text-xs text-yellow-400">
                    {item.price_coins === 0 ? 'Free' : `🪙 ${item.price_coins}`}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
