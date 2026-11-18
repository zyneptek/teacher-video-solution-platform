// Mobil uygulama, giriş yaptıktan sonra Expo push jetonunu buraya kaydeder.
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const pushTokensRouter = Router();

pushTokensRouter.post('/', requireAuth('teacher'), async (req, res) => {
  const token = (req.body as { token?: unknown } | undefined)?.token;
  if (typeof token !== 'string' || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) {
    res.status(400).json({ error: 'Geçersiz push jetonu.' });
    return;
  }
  try {
    await pool.query(
      `insert into push_tokens (token, profile_id) values ($1, $2)
       on conflict (token) do update set profile_id = excluded.profile_id, updated_at = now()`,
      [token, req.user?.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Push jetonu kaydedilemedi:', err);
    res.status(500).json({ error: 'Push jetonu kaydedilemedi.' });
  }
});
