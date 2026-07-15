import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  username: string
  birthdate: string
  equipped: Record<string, string>
  is_admin: boolean
  interests: string[]
  looking_for: string[]
  onboarded: boolean
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  init: () => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,

  init: () => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      set({ session })
      if (session) await get().refreshProfile()
      set({ loading: false })
    })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session })
      if (session) {
        await get().refreshProfile()
      } else {
        set({ profile: null })
      }
    })
  },

  refreshProfile: async () => {
    const userId = get().session?.user.id
    if (!userId) {
      set({ profile: null })
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, birthdate, equipped, is_admin, interests, looking_for, onboarded')
      .eq('id', userId)
      .maybeSingle()
    set({ profile: data })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))
