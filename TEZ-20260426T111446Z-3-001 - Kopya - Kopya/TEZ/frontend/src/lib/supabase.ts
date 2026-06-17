import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
  throw new Error(
    'Supabase yapılandırması eksik. .env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın.',
  )
}

export const supabase = createClient(supabaseUrl.trim(), supabaseAnonKey.trim())
