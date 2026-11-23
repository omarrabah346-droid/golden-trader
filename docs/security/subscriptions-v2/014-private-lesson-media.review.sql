begin;
insert into storage.buckets(id,name,public)
values ('vexora-v2-lesson-media','vexora-v2-lesson-media',false);

create table vx_sub_v2.lesson_media (
  media_id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons(id),
  object_key text not null unique check(length(object_key) between 1 and 500)
);
alter table vx_sub_v2.lesson_media enable row level security;
revoke all on vx_sub_v2.lesson_media from public,anon,authenticated,service_role;

create policy vx_v2_lesson_media_client_fence on storage.objects
as restrictive for all to anon,authenticated
using (bucket_id <> 'vexora-v2-lesson-media')
with check (bucket_id <> 'vexora-v2-lesson-media');

create function public.vx_sub_v2_lesson_media_key(p_media uuid)
returns text language sql stable security definer set search_path='' as $$
  select m.object_key from vx_sub_v2.lesson_media m
  where m.media_id=p_media and public.vx_sub_v2_can_read_lesson(m.lesson_id)
$$;
revoke all on function public.vx_sub_v2_lesson_media_key(uuid) from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_lesson_media_key(uuid) to authenticated;
commit;
