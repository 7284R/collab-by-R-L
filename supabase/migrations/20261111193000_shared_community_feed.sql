create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 50),
  body text not null default '' check (char_length(body) <= 5000),
  image_path text,
  created_at timestamptz not null default now(),
  constraint posts_body_or_image check (char_length(btrim(body)) > 0 or image_path is not null)
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_id_idx on public.post_likes (user_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 50),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_created_at_idx
  on public.post_comments (post_id, created_at);

create or replace function public.is_verified_community_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and email_confirmed_at is not null
  );
$$;

revoke all on function public.is_verified_community_user() from public, anon;
grant execute on function public.is_verified_community_user() to authenticated;

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

grant select on public.posts, public.post_likes, public.post_comments to anon, authenticated;
grant insert, delete on public.posts, public.post_likes, public.post_comments to authenticated;

drop policy if exists "Community posts are public" on public.posts;
create policy "Community posts are public"
  on public.posts for select
  to anon, authenticated
  using (true);

drop policy if exists "Verified members can publish posts" on public.posts;
create policy "Verified members can publish posts"
  on public.posts for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.is_verified_community_user());

drop policy if exists "Members can delete their own posts" on public.posts;
create policy "Members can delete their own posts"
  on public.posts for delete
  to authenticated
  using (user_id = (select auth.uid()) and public.is_verified_community_user());

drop policy if exists "Community post likes are public" on public.post_likes;
create policy "Community post likes are public"
  on public.post_likes for select
  to anon, authenticated
  using (true);

drop policy if exists "Verified members can like posts" on public.post_likes;
create policy "Verified members can like posts"
  on public.post_likes for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.is_verified_community_user());

drop policy if exists "Members can remove their own likes" on public.post_likes;
create policy "Members can remove their own likes"
  on public.post_likes for delete
  to authenticated
  using (user_id = (select auth.uid()) and public.is_verified_community_user());

drop policy if exists "Community post comments are public" on public.post_comments;
create policy "Community post comments are public"
  on public.post_comments for select
  to anon, authenticated
  using (true);

drop policy if exists "Verified members can comment" on public.post_comments;
create policy "Verified members can comment"
  on public.post_comments for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.is_verified_community_user());

drop policy if exists "Members can delete their own comments" on public.post_comments;
create policy "Members can delete their own comments"
  on public.post_comments for delete
  to authenticated
  using (user_id = (select auth.uid()) and public.is_verified_community_user());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-photos',
  'community-photos',
  true,
  1572864,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Community photos are public" on storage.objects;
create policy "Community photos are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'community-photos');

drop policy if exists "Verified members can upload their own photos" on storage.objects;
create policy "Verified members can upload their own photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_verified_community_user()
  );

drop policy if exists "Members can delete their own photos" on storage.objects;
create policy "Members can delete their own photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_verified_community_user()
  );

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['posts', 'post_likes', 'post_comments']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end
$$;
