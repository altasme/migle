import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export function useWallet() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const [wallet, setWallet] = useState<{ coins: number; gems: number } | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('wallets')
      .select('coins, gems')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setWallet(data))
  }, [userId])

  return wallet
}
