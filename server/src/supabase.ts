import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Gizli anahtarla çalışır: yalnızca sunucuda kullanılır, istemciye verilmez.
export const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
