-- Çapraz kontrol: aynı soruya atanmış öğretmenler birbirlerinin onaya gönderilmiş veya onaylanmış çözüm videosunu
-- "hatasız" ya da "hatalı" diye işaretler (isteğe bağlı kısa not). Değerlendirmeyi yalnızca yönetici görür; videonun sahibi görmez.
-- Video değişince (düzenleme, yeniden çekme, geri alma) değerlendirmeler uygulamada silinir; kayıt silinince bu tablodan da düşer.
create table peer_checks (
  id           uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings (id) on delete cascade,
  reviewer_id  uuid not null references profiles (id),
  verdict      text not null check (verdict in ('correct', 'faulty')),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (recording_id, reviewer_id)
);
alter table peer_checks enable row level security;

-- Yöneticiye her değerlendirmede bildirim gider ("X, Y öğretmenin çözümünü hatalı buldu"). Kontrol eden ve karar bildirimde
-- saklanır; değerlendirme sonradan silinse de bildirim anlamını korur.
alter table notifications add column checker_id uuid references profiles (id);
alter table notifications add column check_verdict text check (check_verdict in ('correct', 'faulty'));
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('assignment_created', 'recording_approved', 'recording_returned', 'recording_submitted', 'error_reported', 'peer_checked'));
