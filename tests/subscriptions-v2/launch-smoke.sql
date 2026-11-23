insert into vx_sub_v2.public_signals values ('public-signal');
insert into vx_sub_v2.lesson_media(media_id,lesson_id,object_key)
values('00000000-0000-4000-8000-000000000098','paid-a','fixture.pdf');
insert into storage.objects values ('vexora-v2-receipts','fixture');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select vx_sub_v2_manage_grant('00000000-0000-4000-8000-000000000004','create',null,now()+interval '1 day');

set request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
select ai_ask('fixture','{}','ar');

do $$
begin
  if ai_result(42) is distinct from '42'::jsonb then raise exception 'AI owner access failed'; end if;
  if not vx_sub_v2_can_access('marketing') then raise exception 'Free grant access failed'; end if;
end;
$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';

do $$
begin
  if row_security_active('signals') and (select count(*) from signals)<>1 then raise exception 'Private signal visible'; end if;
  if row_security_active('storage.objects') and exists(select from storage.objects where bucket_id='vexora-v2-receipts') then raise exception 'Receipt object visible'; end if;
  if not vx_sub_v2_can_read_lesson('paid-a') or vx_sub_v2_can_read_lesson('paid-b') then
    raise exception 'Lifetime lesson scope failed';
  end if;
  if vx_sub_v2_lesson_media_key('00000000-0000-4000-8000-000000000098') is distinct from 'fixture.pdf' then
    raise exception 'Lifetime media scope failed';
  end if;
end;
$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select vx_sub_v2_manage_grant('00000000-0000-4000-8000-000000000003','create',null,now()+interval '1 day');

set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';

do $$
begin
  if not vx_sub_v2_can_access('ai') then raise exception 'AI ownership fixture lacks entitlement'; end if;
  begin
    perform ai_result(42);
    raise exception 'Other subscriber read the AI result';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
update vx_sub_v2.subscriptions set revoked_at=null,starts_at=now()-interval '2 days',
  expires_at=now()-interval '1 day' where user_id='00000000-0000-4000-8000-000000000002';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';

do $$
begin
  if vx_sub_v2_can_access('vip') or not vx_sub_v2_can_read_lesson('paid-a') then
    raise exception 'Expired V2 or active legacy grant evaluated incorrectly';
  end if;
end;
$$;
reset role;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
select set_config('vx.test.second_order',order_id::text,false)
from vx_sub_v2_request('00000000-0000-4000-8000-000000000049','00000000-0000-4000-8000-000000000010');

reset role;
set role service_role;
select vx_sub_v2_bind_receipt('00000000-0000-4000-8000-000000000004',
  current_setting('vx.test.second_order')::uuid,
  '00000000-0000-4000-8000-000000000004/'||current_setting('vx.test.second_order')||'/00000000-0000-4000-8000-000000000099.png');
reset role;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select vx_sub_v2_clear_activation('00000000-0000-4000-8000-000000000004',null,'fixture');
do $$
begin
  begin
    perform vx_sub_v2_approve(current_setting('vx.test.second_order')::uuid,'bank:fixture:reference',30000,'USD');
    raise exception 'Duplicate payment approved';
  exception when unique_violation then null;
  end;
  perform vx_sub_v2_approve(current_setting('vx.test.second_order')::uuid,'bank:fixture:second',30000,'USD');
end;
$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
select set_config('vx.test.renew_order',order_id::text,false)
from vx_sub_v2_request('00000000-0000-4000-8000-000000000048','00000000-0000-4000-8000-000000000010')
where kind='renewal' and amount_cents=10000;
reset role;
set role service_role;
select vx_sub_v2_bind_receipt('00000000-0000-4000-8000-000000000004',
  current_setting('vx.test.renew_order')::uuid,
  '00000000-0000-4000-8000-000000000004/'||current_setting('vx.test.renew_order')||'/00000000-0000-4000-8000-000000000099.png');
reset role;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select * from vx_sub_v2_approve(current_setting('vx.test.renew_order')::uuid,'bank:fixture:renew',10000,'USD');
reset role;
do $$
begin
  if not exists (select from vx_sub_v2.settlements first
    join vx_sub_v2.settlements renewal on first.coverage_end=renewal.coverage_start
    where first.payment_key='bank:fixture:second' and renewal.payment_key='bank:fixture:renew') then
    raise exception 'Early renewal did not extend the previous period';
  end if;
end;
$$;
update vx_sub_v2.subscriptions set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day'
where user_id='00000000-0000-4000-8000-000000000004';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';

do $$
begin
  if not exists(select from vx_sub_v2_my_status() where state='expired')
    or not vx_sub_v2_has_free_grant('ai') then raise exception 'Grant lost after V2 expiry'; end if;
  begin
    perform vx_sub_v2_owner_receipt(current_setting('vx.test.second_order')::uuid);
    raise exception 'Non-owner obtained receipt key';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'VEXORA_LAUNCH_SMOKE_PASSED' as result;
