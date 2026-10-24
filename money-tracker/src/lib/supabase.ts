import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { KEYS } from './storage';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * null when this build has no cloud configured (e.g. the single-file artifact):
 * the app then keeps everything on the device, exactly as before accounts existed.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // PKCE returns from e-mail links with ?code=…, leaving the #tab hash alone.
          flowType: 'pkce',
          storageKey: KEYS.authSession,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
