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
