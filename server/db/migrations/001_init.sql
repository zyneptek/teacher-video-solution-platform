-- İlk şema: kullanıcılar, kazanımlar, sorular, atamalar, kayıtlar, bildirimler, hata bildirimleri.
-- Tüm tablolarda RLS açıktır ve politika yoktur: Supabase Data API açılsa bile anon/authenticated
-- roller hiçbir satıra erişemez. Sunucu `postgres` rolüyle bağlandığı için etkilenmez.

-- Kullanıcılar (yönetici ve öğretmen). auth_user_id, Supabase Auth kullanıcısını gösterir.
-- Auth kaydı silinince bu satır SİLİNMEZ (yumuşak silme): atama ve kayıtlar yerinde kalır.
create table profiles (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  role         text not null check (role in ('admin', 'teacher')),
  first_name   text not null,
  last_name    text not null,
  email        text not null,
  branch       text check (branch in ('Türkçe', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji')),
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  -- Öğretmenin branşı zorunlu, yöneticinin branşı yok.
  check ((role = 'teacher' and branch is not null) or (role = 'admin' and branch is null))
);

-- E-posta yalnızca aktif (silinmemiş) kullanıcılarda benzersizdir.
create unique index profiles_email_active_idx on profiles (lower(email)) where deleted_at is null;

-- Kazanım listesi (JSON'daki tüm kodlar). Branş, kod ön ekinden yükleme sırasında eşlenir; boş olabilir.
create table learning_outcomes (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  description text not null,
  branch      text check (branch in ('Türkçe', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji'))
);

create index learning_outcomes_branch_idx on learning_outcomes (branch);

-- Sorular. source_id, soru paketindeki orijinal kimliktir (yüklemeyi tekrar çalıştırılabilir yapar).
-- image_path, Supabase Storage'daki görselin yoludur.
create table questions (
  id              uuid primary key default gen_random_uuid(),
  source_id       text not null unique,
  branch          text not null check (branch in ('Türkçe', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji')),
  answer_key      text not null check (answer_key in ('A', 'B', 'C', 'D', 'E')),
  image_path      text not null,
  question_number integer,
  page_num        integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Soru-kazanım ilişkisi. "En az bir kazanım" kuralı uygulama kodunda denetlenir.
create table question_outcomes (
  question_id uuid   not null references questions (id) on delete cascade,
  outcome_id  bigint not null references learning_outcomes (id),
  primary key (question_id, outcome_id)
);

create index question_outcomes_outcome_idx on question_outcomes (outcome_id);

-- Atama. Aynı soru aynı öğretmene bir kez atanır; geri gönderilince aynı atama üzerinden devam edilir.
-- Durumlar: assigned = Atandı, submitted = Onaya gönderildi, approved = Onaylandı, returned = Geri gönderildi.
create table assignments (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions (id),
  teacher_id   uuid not null references profiles (id),
  status       text not null default 'assigned' check (status in ('assigned', 'submitted', 'approved', 'returned')),
  return_note  text,
  assigned_at  timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at  timestamptz,
  unique (question_id, teacher_id)
);

create index assignments_teacher_idx on assignments (teacher_id);
create index assignments_status_idx on assignments (status);

-- Atamanın güncel videosu (atama başına en fazla bir kayıt; yeniden çekilince yenisi eskisinin yerine geçer).
-- status: processing = sunucu MP4 üretiyor, ready = hazır, failed = üretilemedi.
-- deleted_at dolu olan kayıt yönetici ekranında izlenemez.
create table recordings (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null unique references assignments (id),
  video_path       text,
  duration_seconds numeric,
  status           text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Bildirimler. Metin saklanmaz; tür ve atamadan gösterilirken üretilir. read_at boşsa okunmamıştır.
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles (id),
  assignment_id uuid not null references assignments (id),
  type          text not null check (type in ('assignment_created')),
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

-- Hata bildirimleri. Gönderen öğretmen reporter_id ile belli olur.
create table error_reports (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references questions (id),
  reporter_id     uuid not null references profiles (id),
  type            text not null check (type in ('question_text', 'options', 'typo', 'trim', 'answer_key', 'outcome', 'other')),
  description     text not null,
  attachment_path text,
  attachment_type text check (attachment_type in ('image', 'video')),
  created_at      timestamptz not null default now(),
  check ((attachment_path is null) = (attachment_type is null))
);

create index error_reports_question_idx on error_reports (question_id);

alter table profiles          enable row level security;
alter table learning_outcomes enable row level security;
alter table questions         enable row level security;
alter table question_outcomes enable row level security;
alter table assignments       enable row level security;
alter table recordings        enable row level security;
alter table notifications     enable row level security;
alter table error_reports     enable row level security;
