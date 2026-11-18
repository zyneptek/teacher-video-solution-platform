-- Expo push jetonları. Bir öğretmenin birden fazla cihazı olabilir; aynı jeton tek satırdır
-- (jeton başka bir hesaba geçerse satır yeni sahibine taşınır). RLS açık, politika yok.
create table push_tokens (
  token       text primary key,
  profile_id  uuid not null references profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index push_tokens_profile_idx on push_tokens (profile_id);

alter table push_tokens enable row level security;
