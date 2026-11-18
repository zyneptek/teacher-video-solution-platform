// Giriş, oturum yenileme, çıkış ve "ben kimim" uç noktaları.
// Web ve mobil Supabase'e doğrudan bağlanmaz; yalnızca bu uç noktalarla konuşur.
import { createClient } from '@supabase/supabase-js';
import { Router } from 'express';
import type { LoginResponse, Role } from '@app/shared';
import { findActiveProfile, requireAuth, toUserInfo } from '../auth.js';
import { config } from '../config.js';

export const authRouter = Router();

// Giriş için her seferinde oturum tutmayan ayrı bir istemci kullanılır (sunucudaki ana istemci kirlenmesin).
function authClient() {
  return createClient(config.supabaseUrl, config.supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

const ROLE_LABEL: Record<Role, string> = { admin: 'yönetici', teacher: 'öğretmen' };

// Girişte sekmeyi (role) kullanıcının gerçek rolüyle karşılaştırır: yönetici sekmesine öğretmen giremez.
authRouter.post('/login', async (req, res) => {
  const { email, password, role } = (req.body ?? {}) as { email?: unknown; password?: unknown; role?: unknown };
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || (role !== 'admin' && role !== 'teacher')) {
    res.status(400).json({ error: 'E-posta, şifre ve giriş türü gerekli.' });
    return;
  }
  try {
    const client = authClient();
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session || !data.user) {
      res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
      return;
    }
    const profile = await findActiveProfile(data.user.id);
    if (!profile) {
      res.status(401).json({ error: 'E-posta veya şifre hatalı.' }); // silinmiş hesap da aynı mesajı alır
      return;
    }
    if (profile.role !== role) {
      res.status(403).json({ error: `Bu hesap ${ROLE_LABEL[role]} hesabı değil. Doğru giriş sekmesini seçin.` });
      return;
    }
    const body: LoginResponse = { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, user: toUserInfo(profile) };
    res.json(body);
  } catch (err) {
    console.error('Giriş hatası:', err);
    res.status(500).json({ error: 'Giriş yapılamadı. Lütfen tekrar deneyin.' });
  }
});

// Süresi dolan erişim jetonunu yenileme jetonuyla yeniler.
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = (req.body ?? {}) as { refreshToken?: unknown };
  if (typeof refreshToken !== 'string' || !refreshToken) {
    res.status(400).json({ error: 'Yenileme jetonu gerekli.' });
    return;
  }
  try {
    const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
      return;
    }
    const profile = await findActiveProfile(data.user.id);
    if (!profile) {
      res.status(401).json({ error: 'Hesap kapatılmış veya bulunamadı.' });
      return;
    }
    const body: LoginResponse = { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, user: toUserInfo(profile) };
    res.json(body);
  } catch (err) {
    console.error('Oturum yenileme hatası:', err);
    res.status(500).json({ error: 'Oturum yenilenemedi.' });
  }
});

// Geçerli oturumun kullanıcısı (istemciler açılışta ve kısa aralıklarla çağırır; silinen hesap 401 alır).
authRouter.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});
