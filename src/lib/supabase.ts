import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // This module is imported before React mounts, so a bare throw here
  // leaves a completely blank screen with the real cause visible only in
  // devtools - which don't exist on a phone running the APK. Paint the
  // explanation into the page first, then still throw to halt startup.
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML =
      '<div style="display:flex;min-height:100svh;align-items:center;justify-content:center;padding:2rem;background:#09090b;color:#d4d4d8;font-family:system-ui;text-align:center">' +
      '<p>This build is missing its server configuration.<br/>' +
      'Rebuild with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set<br/>' +
      '(repo secrets for CI builds, .env for local ones).</p></div>'
  }
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
