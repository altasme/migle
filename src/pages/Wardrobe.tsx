import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getAssetUrl } from '../lib/compositor'
import { useAuthStore } from '../store/authStore'
import { AvatarImage } from '../components/AvatarImage'

type ShopItem = {
  id: string
  name: string
  slot: string
  asset_path: string
  price_coins: number | null
}

const SLOTS = ['body', 'hair_front', 'face', 'top', 'hat'] as const

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

  useEffect(() => {
    setEquipped(profile?.equipped ?? {})
  }, [profile?.equipped])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const userId = session!.user.id
    const [itemsRes, invRes] = await Promise.all([
      supabase
        .from('cosmetic_items')
        .select('id, name, slot, asset_path, price_coins')
        .in('slot', SLOTS)
        .eq('is_active', true),
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
      const nextEquipped = { ...equipped, [item.slot]: item.id }
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white">
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-white">Wardrobe</h1>
      </div>

      <div className="flex justify-center">
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900 text-3xl text-white">
          <AvatarImage
            equipped={equipped}
            fallbackLetter={profile?.username[0]?.toUpperCase() ?? '?'}
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {SLOTS.map((slot) => {
        const slotItems = items.filter((i) => i.slot === slot)
        if (slotItems.length === 0) return null
        return (
          <section key={slot}>
            <h2 className="mb-2 text-sm font-medium capitalize text-zinc-400">
              {slot.replace('_', ' ')}
            </h2>
            <div className="flex flex-wrap gap-3">
              {slotItems.map((item) => {
                const isEquipped = equipped[slot] === item.id
                const isOwned = owned.has(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => selectItem(item)}
                    disabled={busy === item.id}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 disabled:opacity-50 ${
                      isEquipped ? 'border-purple-500' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-zinc-900">
                      <img
                        src={getAssetUrl(item.asset_path)}
                        alt={item.name}
                        className="h-full w-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400">{item.name}</span>
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
        )
      })}
    </div>
  )
}
