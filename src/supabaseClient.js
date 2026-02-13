import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Client khusus untuk akses public (tanpa session user)
// Ini mencegah error 401 jika session user kadaluarsa/rusak saat akses halaman public
export const supabasePublic = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, { 
      auth: { 
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'public-auth-token', // Kunci penyimpanan berbeda agar tidak bentrok
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      } 
    }) 
  : null;


