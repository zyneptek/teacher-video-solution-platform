-- Düzenleme geçmişi ("Geri al"): her kırpma/silme işleminden önceki video sürümü burada saklanır.
-- Yeniden çekme veya kaydı silme geçmişi temizler. En son eklenen sürüm geri alınır.
create table recording_history (
  id               uuid primary key default gen_random_uuid(),
  recording_id     uuid not null references recordings (id),
  video_path       text not null,
  duration_seconds numeric not null,
  created_at       timestamptz not null default now()
);
alter table recording_history enable row level security;
