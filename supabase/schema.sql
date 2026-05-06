-- Run in Supabase: Dashboard → SQL → New query. Step-by-step: README "Supabase setup".
-- Stores the full multi-profile ROOT blob as JSON (Phase D sync).

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_state_updated_at_idx on public.user_state (updated_at desc);

alter table public.user_state enable row level security;

create policy "user_state_select_own"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "user_state_insert_own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "user_state_update_own"
  on public.user_state for update
  using (auth.uid() = user_id);

create policy "user_state_delete_own"
  on public.user_state for delete
  using (auth.uid() = user_id);

-- Previous cloud payloads (archived before each upload when a prior cloud row exists).
-- The app keeps at most 2 snapshots per user from the rolling last 48 hours (prune runs client-side after each insert).
create table if not exists public.user_state_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  saved_at timestamptz not null
);

create index if not exists user_state_history_user_saved_idx on public.user_state_history (user_id, saved_at desc);

alter table public.user_state_history enable row level security;

create policy "user_state_history_select_own"
  on public.user_state_history for select
  using (auth.uid() = user_id);

create policy "user_state_history_insert_own"
  on public.user_state_history for insert
  with check (auth.uid() = user_id);

create policy "user_state_history_delete_own"
  on public.user_state_history for delete
  using (auth.uid() = user_id);
