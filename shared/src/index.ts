// Sunucu, web ve mobilin ortak kullandığı tipler ve sabitler.

export const BRANCHES = ['Türkçe', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji'] as const;

export type Branch = (typeof BRANCHES)[number];
