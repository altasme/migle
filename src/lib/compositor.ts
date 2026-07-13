import { supabase } from './supabase'

export type CosmeticItemRow = {
  id: string
  slot: string
  z_index: number
  asset_path: string
  hides_slots: string[]
}

const itemCache = new Map<string, CosmeticItemRow>()
const compositeCache = new Map<string, Promise<string>>()

const CANVAS_SIZE = 64

export function hashEquipped(ids: string[]) {
  return [...ids].sort().join(',')
}

export function getAssetUrl(assetPath: string) {
  const base = import.meta.env.VITE_SUPABASE_URL as string
  return `${base}/storage/v1/object/public/cosmetics${assetPath}`
}

async function fetchItems(ids: string[]): Promise<CosmeticItemRow[]> {
  const missing = ids.filter((id) => !itemCache.has(id))
  if (missing.length > 0) {
    const { data } = await supabase
      .from('cosmetic_items')
      .select('id, slot, z_index, asset_path, hides_slots')
      .in('id', missing)
    for (const row of (data ?? []) as CosmeticItemRow[]) {
      itemCache.set(row.id, row)
    }
  }
  return ids.map((id) => itemCache.get(id)).filter((r): r is CosmeticItemRow => !!r)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

// Composites equipped cosmetic layers to ONE offscreen canvas, respecting
// z_index stacking and hides_slots (e.g. a hat hiding hair_front) — never
// special-cased per slot pair. Result is cached by a hash of the equipped
// item ids so the same combo (worn by any number of people) renders once.
async function render(ids: string[]): Promise<string> {
  const items = await fetchItems(ids)
  const hiddenSlots = new Set(items.flatMap((i) => i.hides_slots ?? []))
  const visible = items.filter((i) => !hiddenSlots.has(i.slot)).sort((a, b) => a.z_index - b.z_index)

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const images = await Promise.all(visible.map((i) => loadImage(getAssetUrl(i.asset_path))))
  for (const img of images) {
    ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }

  return canvas.toDataURL('image/png')
}

export function compositeAvatar(ids: string[]): Promise<string> {
  const key = hashEquipped(ids)
  if (!compositeCache.has(key)) {
    compositeCache.set(key, render(ids))
  }
  return compositeCache.get(key)!
}
