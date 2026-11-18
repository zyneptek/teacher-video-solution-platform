// Sunucu, web ve mobilin ortak kullandığı tipler ve sabitler.

export const BRANCHES = ['Türkçe', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji'] as const;

export type Branch = (typeof BRANCHES)[number];

// Kazanım kodunun ön eki → branş. Listede olmayan ön ekler (COG, TAR, FEL, DİN, İNG, ROOT) branşsızdır.
const BRANCH_BY_OUTCOME_PREFIX: Record<string, Branch> = {
  TDE: 'Türkçe',
  TÜR: 'Türkçe',
  MAT: 'Matematik',
  GEO: 'Matematik',
  FİZ: 'Fizik',
  KİM: 'Kimya',
  BİY: 'Biyoloji',
};

export function branchFromOutcomeCode(code: string): Branch | null {
  const prefix = code.normalize('NFC').split('.')[0] ?? '';
  return BRANCH_BY_OUTCOME_PREFIX[prefix] ?? null;
}

export * from './drawing';
export * from './inkController';

// ---- Kimlik doğrulama ve kullanıcı tipleri (sunucu, web ve mobil ortak) ----

export type Role = 'admin' | 'teacher';

// İstemcilere dönen kullanıcı bilgisi (şifre gibi hassas alan yok).
export type UserInfo = {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  branch: Branch | null;
};

export type LoginResponse = { accessToken: string; refreshToken: string; user: UserInfo };

// Öğretmen listesi satırı (yönetici ekranı).
export type TeacherInfo = Omit<UserInfo, 'role'> & { createdAt: string };
