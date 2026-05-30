-- Kiaro Studio Commissions MVP schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Private storage bucket for customer files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('commission-files', 'commission-files', false, 52428800, null)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  access_key text not null unique,
  name text,
  email text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid references public.guest_sessions(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null default 'New commission conversation',
  status text not null default 'open' check (status in ('open','waiting_customer','waiting_admin','offer_sent','paid','delivered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  uploaded_by text not null check (uploaded_by in ('customer','admin','system')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  kind text not null default 'file' check (kind in ('image','file','annotation')),
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'USD',
  scope text not null,
  payment_url text not null,
  provider text not null default 'external_link',
  status text not null default 'sent' check (status in ('draft','sent','paid','cancelled','expired')),
  provider_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('customer','admin','system')),
  type text not null default 'text' check (type in ('text','attachment','offer','payment_update','system')),
  body text,
  attachment_id uuid references public.attachments(id) on delete set null,
  offer_id uuid references public.offers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  source_attachment_id uuid not null references public.attachments(id) on delete cascade,
  result_attachment_id uuid references public.attachments(id) on delete set null,
  created_by text not null check (created_by in ('customer','admin')),
  strokes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_tags (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique(conversation_id, tag)
);

create index if not exists idx_guest_sessions_access_key on public.guest_sessions(access_key);
create index if not exists idx_conversations_updated_at on public.conversations(updated_at desc);
create index if not exists idx_conversations_guest on public.conversations(guest_session_id);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at asc);
create index if not exists idx_attachments_conversation on public.attachments(conversation_id, created_at desc);
create index if not exists idx_offers_conversation on public.offers(conversation_id, created_at desc);

create or replace function public.touch_conversation()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation_on_message on public.messages;
create trigger touch_conversation_on_message
after insert on public.messages
for each row execute function public.touch_conversation();

drop trigger if exists touch_conversation_on_attachment on public.attachments;
create trigger touch_conversation_on_attachment
after insert on public.attachments
for each row execute function public.touch_conversation();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.offers enable row level security;
alter table public.annotations enable row level security;
alter table public.admin_notes enable row level security;
alter table public.conversation_tags enable row level security;

-- Browser clients should not read private rows directly in the MVP.
-- All guest/customer access goes through server API routes that validate access keys.
-- Service role bypasses RLS.

create policy "Profiles can read their own profile" on public.profiles
for select to authenticated
using (auth.uid() = id);

create policy "Profiles can update their own profile" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Future authenticated customer policies.
create policy "Authenticated users can read their conversations" on public.conversations
for select to authenticated
using (auth.uid() = user_id);

create policy "Authenticated users can read messages in their conversations" on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
);

create policy "Authenticated users can read attachments in their conversations" on public.attachments
for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = attachments.conversation_id and c.user_id = auth.uid()
  )
);

-- Storage remains private; signed URLs are generated server-side.
