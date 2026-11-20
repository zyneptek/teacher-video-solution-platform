import pg from 'pg';
import { config } from './config.js';

// Supabase pooler'ına bağlanır. Bağlantı şifrelidir (SSL). Sertifika zinciri
// doğrulanmaz; ileride Supabase CA sertifikası eklenerek sıkılaştırılabilir.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// Havuzda boşta bekleyen bir bağlantıyı Supabase kapatırsa (bağlantı havuzu zaman aşımı, bakım, ağ kesintisi) pg havuzda
// 'error' olayı üretir. Dinleyici yoksa Node bunu yakalanmamış hata sayar ve sunucu süreci kapanır. Burada yalnızca
// kaydedilir: pg bozuk bağlantıyı havuzdan atar, bir sonraki sorgu yeni bağlantı açar. Çalışan sorgular etkilenmez.
pool.on('error', (err) => {
  console.error('Veritabanı havuzunda boşta bağlantı hatası (sunucu çalışmaya devam ediyor):', err.message);
});
