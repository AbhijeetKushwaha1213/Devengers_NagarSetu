import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Universal environment variable resolver supporting Vite browser and Node test environments
const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch {
    // Ignore in non-ESM or Node environments
  }

  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {
    // Ignore in non-Node environments
  }

  return undefined;
};

const rawSupabaseUrl =
  getEnvVar('VITE_SUPABASE_URL') ||
  getEnvVar('SUPABASE_URL') ||
  'https://rhqeubludshvmncaclki.supabase.co';

const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

const supabaseAnonKey =
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY') ||
  'your-supabase-anon-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const testSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('test').select('*').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('Supabase connection failed:', error);
      return false;
    }
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
};

export const testSupabaseAuth = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Supabase Auth connection successful, current user:', user ? 'logged in' : 'not logged in');
    return true;
  } catch (error) {
    console.error('Supabase Auth connection failed:', error);
    return false;
  }
};

export default supabase;
