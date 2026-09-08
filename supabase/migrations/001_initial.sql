create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  spotify_user_id text unique not null,
  display_name text,
  avatar_url text,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  quiz_version text not null default 'v1',
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_created_idx
  on public.quiz_attempts(user_id, created_at desc);

alter table public.users enable row level security;
alter table public.quiz_attempts enable row level security;
