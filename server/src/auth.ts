// Kimlik doğrulama: istemci her istekte Supabase erişim jetonunu `Authorization: Bearer` ile gönderir.
// Jeton Supabase'e doğrulatılır, ardından kullanıcının profili okunur. Silinmiş (deleted_at dolu) veya
// profili olmayan kullanıcı 401 alır; istemciler 401'de oturumu kapatır. Böylece silinen öğretmenin
// açık oturumu bir sonraki istekte (veya istemcinin kısa aralıklı kontrolünde) sonlanır.
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';
import type { Branch, Role, UserInfo } from '@app/shared';
import { config } from './config.js';
import { pool } from './db.js';
import { supabase } from './supabase.js';

export type ProfileRow = {
  id: string;
  role: Role;
  first_name: string;
  last_name: string;
  email: string;
  branch: Branch | null;
};

export function toUserInfo(row: ProfileRow): UserInfo {
  return { id: row.id, role: row.role, firstName: row.first_name, lastName: row.last_name, email: row.email, branch: row.branch };
}

// Aktif (silinmemiş) profili Supabase Auth kimliğine göre bulur.
export async function findActiveProfile(authUserId: string): Promise<ProfileRow | null> {
  const { rows } = await pool.query<ProfileRow>(
    'select id, role, first_name, last_name, email, branch from profiles where auth_user_id = $1 and deleted_at is null',
    [authUserId],
  );
  return rows[0] ?? null;
}

// Jeton, Supabase'in açık anahtarlarıyla (JWKS, önbellekli) sunucuda yerel olarak doğrulanır; her istekte
// Supabase'e ağ çağrısı yapılmaz. Yerel doğrulama başarısız olursa (örneğin farklı imza türü) Supabase'e sorulur.
const jwks = createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`));

async function authUserIdFromToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: `${config.supabaseUrl}/auth/v1`, audience: 'authenticated' });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return null; // süresi dolmuş: istemci yeniler
    const { data, error } = await supabase.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  }
}

// Profil kısa süre önbelleğe alınır (silinen hesap en geç bu süre sonra reddedilir).
const PROFILE_TTL_MS = 10_000;
const profileCache = new Map<string, { profile: ProfileRow | null; at: number }>();

export function forgetProfile(authUserId: string | null): void {
  if (authUserId) profileCache.delete(authUserId);
}

async function cachedActiveProfile(authUserId: string): Promise<ProfileRow | null> {
  const hit = profileCache.get(authUserId);
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.profile;
  const profile = await findActiveProfile(authUserId);
  profileCache.set(authUserId, { profile, at: Date.now() });
  return profile;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserInfo;
  }
}

// İsteği doğrular; roles verilirse yalnızca o roller geçer (403).
export function requireAuth(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' });
      return;
    }
    try {
      const authUserId = await authUserIdFromToken(token);
      if (!authUserId) {
        res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
        return;
      }
      const profile = await cachedActiveProfile(authUserId);
      if (!profile) {
        res.status(401).json({ error: 'Hesap kapatılmış veya bulunamadı.' });
        return;
      }
      if (roles.length > 0 && !roles.includes(profile.role)) {
        res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        return;
      }
      req.user = toUserInfo(profile);
      next();
    } catch (err) {
      console.error('Kimlik doğrulama hatası:', err);
      res.status(500).json({ error: 'Beklenmeyen bir hata oluştu.' });
    }
  };
}
