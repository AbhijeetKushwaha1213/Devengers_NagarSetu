/**
 * Canonical Supabase client instance shared across the entire application.
 * Re-exports the unified client from backend/lib/supabase to prevent multiple
 * GoTrueClient instances under the same storage key.
 */
export { supabase, testSupabaseConnection, testSupabaseAuth } from '../../backend/lib/supabase';
export { default } from '../../backend/lib/supabase';