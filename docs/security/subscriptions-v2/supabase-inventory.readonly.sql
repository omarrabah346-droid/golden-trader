-- VEXORA inventory. One read-only query, one JSON result. No application rows.
-- Literal-bearing definitions are deliberately omitted. Review them manually
-- in the dashboard and share only sanitized excerpts.
with relations as (
  select c.oid,n.nspname as schema_name,c.relname as name,c.relkind,c.relrowsecurity,c.relforcerowsecurity
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where (n.nspname='public' and c.relname in
    ('profiles','config','purchases','courses','lessons','lesson_bodies','lesson_progress','signals','signal_events'))
    or (n.nspname='storage' and c.relname in ('buckets','objects'))
    or (n.nspname='vx_sub_v2' and c.relkind in ('r','p','v'))
),
routines as (
  select p.oid,n.nspname as schema_name,p.proname as name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
    pg_catalog.pg_get_function_result(p.oid) as result,
    p.prosecdef as security_definer,p.provolatile as volatility,p.proacl as acl
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and (
    n.nspname='vx_sub_v2' or (n.nspname='public' and (
      p.proname in ('admin_purchases','lesson_body_tr','ai_ask','ai_result','ai_status')
      or left(p.proname,10)='vx_sub_v2_'
      or left(p.proname,13)='vx_marketing_'
    ))
  )
)
select pg_catalog.jsonb_build_object(
  'relations', (select coalesce(pg_catalog.jsonb_agg(to_jsonb(r)-'oid' order by r.schema_name,r.name),'[]') from relations r),
  'columns', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schema',r.schema_name,'relation',r.name,'column',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
    'not_null',a.attnotnull,'has_default',a.atthasdef,'identity',a.attidentity,'generated',a.attgenerated
  ) order by r.schema_name,r.name,a.attnum),'[]')
  from relations r join pg_catalog.pg_attribute a on a.attrelid=r.oid where a.attnum>0 and not a.attisdropped),
  'constraints', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schema',r.schema_name,'relation',r.name,'name',c.conname,'type',c.contype,
    'columns',array(select a.attname from unnest(c.conkey) with ordinality k(num,pos)
      join pg_catalog.pg_attribute a on a.attrelid=r.oid and a.attnum=k.num order by k.pos),
    'referenced_relation',case when c.confrelid<>0 then c.confrelid::regclass::text end,
    'referenced_columns',array(select a.attname from unnest(c.confkey) with ordinality k(num,pos)
      join pg_catalog.pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by k.pos),
    'validated',c.convalidated
  )),'[]') from relations r join pg_catalog.pg_constraint c on c.conrelid=r.oid),
  'indexes', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schema',r.schema_name,'relation',r.name,'index',i.indexrelid::regclass::text,
    'unique',i.indisunique,'valid',i.indisvalid,'partial',i.indpred is not null,
    'columns',array(select a.attname from unnest(i.indkey) with ordinality k(num,pos)
      left join pg_catalog.pg_attribute a on a.attrelid=r.oid and a.attnum=k.num order by k.pos)
  )),'[]') from relations r join pg_catalog.pg_index i on i.indrelid=r.oid),
  'policies', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schema',r.schema_name,'relation',r.name,'policy',p.polname,
    'command',p.polcmd,'permissive',p.polpermissive,'roles',array(select case when role_id=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_id)::text end from unnest(p.polroles) as roles(role_id)),
    'has_using',p.polqual is not null,'has_with_check',p.polwithcheck is not null
  )),'[]') from relations r join pg_catalog.pg_policy p on p.polrelid=r.oid),
  'triggers', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'schema',r.schema_name,'relation',r.name,'trigger',t.tgname,'enabled',t.tgenabled,
    'function',t.tgfoid::regprocedure::text
  )),'[]') from relations r join pg_catalog.pg_trigger t on t.tgrelid=r.oid where not t.tgisinternal),
  'routines', (select coalesce(pg_catalog.jsonb_agg(to_jsonb(f)-'oid' order by f.schema_name,f.name,f.arguments),'[]') from routines f),
  'relation_grants', (select coalesce(pg_catalog.jsonb_agg(to_jsonb(g)),'[]')
    from information_schema.table_privileges g
    join relations r on (g.table_schema,g.table_name)=(r.schema_name,r.name)),
  'storage_buckets', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',b.id,'public',b.public)),'[]')
    from storage.buckets b where b.id in ('receipts','media','certs','avatars','partner-docs','entries','journal'))
) as vexora_schema_inventory;
