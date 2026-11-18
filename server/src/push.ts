// Push bildirimi: Expo Push servisi. Mobil uygulama giriş yapınca Expo jetonunu sunucuya kaydeder;
// atamada o öğretmenin tüm cihazlarına gönderilir. Jeton yoksa (uygulama yüklü değil) sessizce geçilir.
// Expo Go ve geliştirme sürümlerinde ek anahtar gerekmez.
import { pool } from './db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPush(profileId: string, title: string, body: string, data: Record<string, unknown>): Promise<number> {
  const { rows } = await pool.query<{ token: string }>('select token from push_tokens where profile_id = $1', [profileId]);
  if (rows.length === 0) return 0;
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(rows.map((r) => ({ to: r.token, title, body, data, sound: 'default' }))),
    });
    if (!response.ok) {
      console.error('Push gönderilemedi: Expo yanıtı', response.status);
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.error('Push gönderilemedi:', err instanceof Error ? err.message : err);
    return 0;
  }
}
