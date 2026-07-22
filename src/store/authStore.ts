import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { PromptAnswer } from '../lib/tags'

export type Profile = {
  id: string
  username: string
  birthdate: string
  equipped: Record<string, string>
  is_admin: boolean
  interests: string[]
  looking_for: string[]
  onboarded: boolean
  bio: string | null
  personality_traits: string[]
  prompt_answers: PromptAnswer[]
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
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, username, birthdate, equipped, is_admin, interests, looking_for, onboarded, bio, personality_traits, prompt_answers',
      )
      .eq('id', userId)
      .maybeSingle()
    // A query error (e.g. a column a migration hasn't added yet) used to
    // silently produce `data: null` here, which is indistinguishable from
    // "this account has no profile row" - every signed-in user got bounced
    // to Claim Username, not just genuinely new ones. Surface it and keep
    // whatever profile we already had rather than wiping out a good one.
    if (error) {
      console.error('refreshProfile failed:', error)
      return
    }
    set({ profile: data })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))
