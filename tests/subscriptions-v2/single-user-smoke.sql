set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$
declare
  v_order uuid;
  v_repeat uuid;
  v_count int;
begin
  select order_id into strict v_order from public.vx_sub_v2_request(
    '00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010');
  select order_id into strict v_repeat from public.vx_sub_v2_request(
    '00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010');
  if v_repeat is distinct from v_order then raise exception 'Idempotency failed'; end if;
  perform set_config('vx.test.order',v_order::text,false);
  begin
    perform public.vx_sub_v2_approve(v_order,'bank:fixture:reference',30000,'USD');
    raise exception 'Member approved payment';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into v_count from vx_sub_v2.orders;
    raise exception 'Member read private orders directly';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set role service_role;
select public.vx_sub_v2_bind_receipt(
  '00000000-0000-4000-8000-000000000002', current_setting('vx.test.order')::uuid,
  '00000000-0000-4000-8000-000000000002/'||current_setting('vx.test.order')||
  '/00000000-0000-4000-8000-000000000099.png');
reset role;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select * from public.vx_sub_v2_approve(current_setting('vx.test.order')::uuid,'bank:fixture:reference',30000,'USD');

do $$
declare
  v_features text[];
  v_state text;
  v_job record;
begin

  if not exists(select from public.vx_sub_v2_owner_review() where receipt_ready and state='approved')
    then raise exception 'Owner review failed'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
  select features into strict v_features from public.vx_sub_v2_my_status();
  if v_features<>array['academy','vip','indicators','marketing','ai','extras']::text[] then raise exception 'Entitlements failed'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
  if exists(select from public.vx_sub_v2_my_orders()) then raise exception 'Cross-account order leak'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  select * into strict v_job from public.vx_sub_v2_provider_work() where provider='telegram';
  if not v_job.desired_access then raise exception 'Expected Telegram access'; end if;
  v_state:=public.vx_sub_v2_provider_result(v_job.user_id,v_job.revision,v_job.due_at,v_job.provider,false,null,'fixture_error');
  if v_state is distinct from 'failed' then raise exception 'Provider failure not logged'; end if;
  v_state:=public.vx_sub_v2_provider_result(v_job.user_id,v_job.revision,v_job.due_at,v_job.provider,true,true,null);
  if v_state is distinct from 'succeeded' then raise exception 'Provider success not logged'; end if;
end;
$$;

select public.vx_sub_v2_revoke('00000000-0000-4000-8000-000000000002','fixture revoke');

do $$
begin
  if not exists(select from public.vx_sub_v2_provider_work() where not desired_access)
    then raise exception 'Revocation did not queue provider work'; end if;
end;
$$;
reset role;
do $$
begin
  if not (select access_active from public.legacy_payment_fixture where id=1)
    then raise exception 'Legacy fixture changed'; end if;
end;
$$;

-- Temporarily grant SELECT to test that RLS also filters rows independently of grants.

begin;
grant usage on schema vx_sub_v2 to authenticated;
grant select on vx_sub_v2.orders,vx_sub_v2.subscriptions to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
do $$
begin
  if exists(select from vx_sub_v2.orders) or exists(select from vx_sub_v2.subscriptions)
    then raise exception 'Cross-account RLS leak'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
  if (select count(*) from vx_sub_v2.orders)<>1 or
     (select count(*) from vx_sub_v2.subscriptions)<>1 then raise exception 'Owner row RLS failed'; end if;
end;
$$;
rollback;

select 'VEXORA_SINGLE_USER_SMOKE_PASSED' as result;