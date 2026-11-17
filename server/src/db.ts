import pg from 'pg';
import { config } from './config.js';

// Supabase pooler'ına bağlanır. Bağlantı şifrelidir (SSL). Sertifika zinciri
// doğrulanmaz; ileride Supabase CA sertifikası eklenerek sıkılaştırılabilir.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
});
