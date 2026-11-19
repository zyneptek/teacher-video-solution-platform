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

// Yönetici paneli özeti.
export type AssignmentStatus = 'assigned' | 'submitted' | 'approved' | 'returned';

export type DashboardStats = {
  teachers: number;
  questions: number;
  outcomes: number;
  assignments: Record<AssignmentStatus, number>;
  errorReports: number;
};

// Yönetici: soru ve kazanım tipleri.
export type OutcomeInfo = { id: number; code: string; description: string; branch: Branch | null };

export type QuestionInfo = {
  id: string;
  branch: Branch;
  answerKey: 'A' | 'B' | 'C' | 'D' | 'E';
  questionNumber: number | null;
  imageUrl: string | null; // Storage'daki özel görsel için süreli imzalı adres
  outcomes: OutcomeInfo[];
  assignmentCount: number;
};

export const ANSWER_KEYS = ['A', 'B', 'C', 'D', 'E'] as const;

// Atama (yönetici listesi). Durumlar: assigned = Atandı, submitted = Onaya gönderildi,
// approved = Onaylandı, returned = Geri gönderildi.
export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  assigned: 'Atandı',
  submitted: 'Onaya gönderildi',
  approved: 'Onaylandı',
  returned: 'Geri gönderildi',
};

// Atamanın güncel çözüm videosu (sunucuda üretilmiş MP4). videoUrl, süreli imzalı bir adrestir.
export type RecordingInfo = { id: string; videoUrl: string; durationSeconds: number; updatedAt: string; canUndo?: boolean };

export type AssignmentInfo = {
  id: string;
  questionId: string;
  questionNumber: number | null;
  branch: Branch;
  teacherId: string;
  teacherName: string;
  status: AssignmentStatus;
  returnNote: string | null;
  assignedAt: string;
  submittedAt: string | null;
  recording: RecordingInfo | null;
};

// Atama sonrası bildirim sonuçları: e-posta durumu ve push gönderilen cihaz sayısı.
export type AssignmentDelivery = {
  email: 'sent' | 'not_configured' | 'failed';
  pushDevices: number;
};

// Öğretmen: atanan soru ve bildirim tipleri.
// Aynı soru için başka bir öğretmenin onaya gönderilmiş veya onaylanmış çözüm videosu (çapraz atamada yeni öğretmen izleyebilir).
export type ReferenceVideo = { teacherName: string; status: AssignmentStatus; recording: RecordingInfo };

export type TeacherAssignment = {
  id: string;
  status: AssignmentStatus;
  returnNote: string | null;
  assignedAt: string;
  recording: RecordingInfo | null;
  referenceVideos?: ReferenceVideo[]; // yalnızca soru detayında dolar
  question: { id: string; branch: Branch; questionNumber: number | null; imageUrl: string; outcomes: OutcomeInfo[] };
};

export type NotificationInfo = {
  id: string;
  type: 'assignment_created' | 'recording_approved' | 'recording_returned' | 'recording_submitted' | 'error_reported';
  text: string;
  href: string; // tıklayınca gidilecek sayfa (#/...)
  readAt: string | null;
  createdAt: string;
};

// Hata bildirimi türleri (en az görevdeki altısı + serbest metin).
export const ERROR_REPORT_TYPES = [
  { value: 'question_text', label: 'Soru metninde hata' },
  { value: 'options', label: 'Şıklarda hata' },
  { value: 'typo', label: 'Yazım yanlışı' },
  { value: 'trim', label: 'Kırpma hatası' },
  { value: 'answer_key', label: 'Cevap anahtarı hatası' },
  { value: 'outcome', label: 'Kazanım hatası' },
  { value: 'other', label: 'Diğer' },
] as const;

export type ErrorReportType = (typeof ERROR_REPORT_TYPES)[number]['value'];

export const ERROR_REPORT_LIMITS = {
  descriptionMax: 1000,
  imageBytes: 5 * 1024 * 1024,
  videoBytes: 30 * 1024 * 1024,
  videoSeconds: 60,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  videoTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
} as const;

export type ErrorReportInfo = {
  id: string;
  questionId: string;
  questionLabel: string; // örn. "Fizik — Soru 2"
  reporterName: string;
  type: ErrorReportType;
  description: string;
  marker: { x: number; y: number } | null;
  attachment: { url: string; type: 'image' | 'video' } | null;
  createdAt: string;
};
