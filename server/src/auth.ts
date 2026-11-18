// Kimlik doğrulama: istemci her istekte Supabase erişim jetonunu `Authorization: Bearer` ile gönderir.
// Jeton Supabase'e doğrulatılır, ardından kullanıcının profili okunur. Silinmiş (deleted_at dolu) veya
// profili olmayan kullanıcı 401 alır; istemciler 401'de oturumu kapatır. Böylece silinen öğretmenin
// açık oturumu bir sonraki istekte (veya istemcinin kısa aralıklı kontrolünde) sonlanır.
import type { NextFunction, Request, Response } from 'express';
import type { Branch, Role, UserInfo } from '@app/shared';
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
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
        return;
      }
      const profile = await findActiveProfile(data.user.id);
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
