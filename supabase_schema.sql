-- DUNTA TAXI - BACKEND REALTIME
-- Execute este ficheiro inteiro no Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null unique,
  role text not null check (role in ('passenger','driver')),
  vehicle text,
  vehicle_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.profiles(id) on delete cascade,
  driver_name text not null,
  vehicle_type text not null default 'taxi',
  phone text,
  latitude double precision not null,
  longitude double precision not null,
  is_online boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.passenger_locations (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid unique references public.profiles(id) on delete cascade,
  passenger_phone text,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  passenger_phone text,
  passenger_name text,
  passenger_lat double precision not null,
  passenger_lng double precision not null,
  destination text not null,
  vehicle_type text not null default 'any',
  status text not null default 'pending' check (status in ('pending','accepted','completed','cancelled')),
  driver_id uuid references public.profiles(id) on delete set null,
  driver_location_id uuid references public.drivers_locations(id) on delete set null,
  driver_name text,
  driver_phone text,
  driver_vehicle_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.passenger_locations add column if not exists passenger_id uuid;
alter table public.ride_requests add column if not exists passenger_id uuid;
alter table public.ride_requests add column if not exists driver_location_id uuid;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,name,phone,role,vehicle,vehicle_id)
  values (new.id,coalesce(new.raw_user_meta_data->>'name','Utilizador DUNTA'),coalesce(new.raw_user_meta_data->>'phone',new.email),coalesce(new.raw_user_meta_data->>'role','passenger'),new.raw_user_meta_data->>'vehicle',new.raw_user_meta_data->>'vehicle_id')
  on conflict (id) do update set name=excluded.name, phone=excluded.phone, role=excluded.role, vehicle=excluded.vehicle, vehicle_id=excluded.vehicle_id, updated_at=now();
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.drivers_locations enable row level security;
alter table public.passenger_locations enable row level security;
alter table public.ride_requests enable row level security;

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles for select using (id=auth.uid());
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists "drivers public read online" on public.drivers_locations;
create policy "drivers public read online" on public.drivers_locations for select using (is_online=true or driver_id=auth.uid());
drop policy if exists "driver own insert" on public.drivers_locations;
create policy "driver own insert" on public.drivers_locations for insert with check (driver_id=auth.uid());
drop policy if exists "driver own update" on public.drivers_locations;
create policy "driver own update" on public.drivers_locations for update using (driver_id=auth.uid()) with check (driver_id=auth.uid());
drop policy if exists "passenger own location" on public.passenger_locations;
create policy "passenger own location" on public.passenger_locations for all using (passenger_id=auth.uid()) with check (passenger_id=auth.uid());
drop policy if exists "ride passenger insert" on public.ride_requests;
create policy "ride passenger insert" on public.ride_requests for insert with check (passenger_id=auth.uid());
drop policy if exists "ride passenger read" on public.ride_requests;
create policy "ride passenger read" on public.ride_requests for select using (passenger_id=auth.uid() or driver_id=auth.uid());
drop policy if exists "ride driver accept" on public.ride_requests;
create policy "ride driver accept" on public.ride_requests for update using (status='pending' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='driver')) with check (driver_id=auth.uid());

do $$ begin alter publication supabase_realtime add table public.drivers_locations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ride_requests; exception when duplicate_object then null; end $$;

create index if not exists idx_drivers_online on public.drivers_locations(is_online);
create index if not exists idx_rides_passenger on public.ride_requests(passenger_id,created_at desc);
create index if not exists idx_rides_driver on public.ride_requests(driver_id,created_at desc);
create index if not exists idx_rides_status on public.ride_requests(status);

update public.drivers_locations set is_online=false where is_online=true and updated_at < now() - interval '60 seconds';

alter table public.profiles add column if not exists avatar_url text;
alter table public.drivers_locations add column if not exists avatar_url text;
alter table public.ride_requests add column if not exists passenger_avatar_url text;
alter table public.ride_requests add column if not exists driver_avatar_url text;

insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict (id) do update set public=true;
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id='avatars');
drop policy if exists "avatars authenticated upload own folder" on storage.objects;
create policy "avatars authenticated upload own folder" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "avatars authenticated update own folder" on storage.objects;
create policy "avatars authenticated update own folder" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "avatars authenticated delete own folder" on storage.objects;
create policy "avatars authenticated delete own folder" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,name,phone,role,vehicle,vehicle_id,avatar_url)
  values (new.id,coalesce(new.raw_user_meta_data->>'name','Utilizador DUNTA'),coalesce(new.raw_user_meta_data->>'phone',new.email),coalesce(new.raw_user_meta_data->>'role','passenger'),new.raw_user_meta_data->>'vehicle',new.raw_user_meta_data->>'vehicle_id',new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do update set name=excluded.name, phone=excluded.phone, role=excluded.role, vehicle=excluded.vehicle, vehicle_id=excluded.vehicle_id, avatar_url=coalesce(excluded.avatar_url,public.profiles.avatar_url), updated_at=now();
  return new;
end $$;

create or replace function public.sync_profile_avatar()
returns trigger language plpgsql security definer set search_path=public
as $$
begin update public.drivers_locations set avatar_url=new.avatar_url where driver_id=new.id; return new; end $$;
drop trigger if exists sync_profile_avatar_after_update on public.profiles;
create trigger sync_profile_avatar_after_update after update of avatar_url on public.profiles for each row execute procedure public.sync_profile_avatar();

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  token text not null, platform text not null default 'android', enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, token)
);
alter table public.push_tokens enable row level security;
drop policy if exists "push token own insert" on public.push_tokens;
create policy "push token own insert" on public.push_tokens for insert with check (user_id=auth.uid());
drop policy if exists "push token own update" on public.push_tokens;
create policy "push token own update" on public.push_tokens for update using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "push token own select" on public.push_tokens;
create policy "push token own select" on public.push_tokens for select using (user_id=auth.uid());
create index if not exists idx_push_tokens_user_enabled on public.push_tokens(user_id, enabled, platform);
