begin;
create function public.vx_sub_v2_may_upload_receipt(p_order uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from vx_sub_v2.orders o
    where o.id=p_order and o.user_id=auth.uid() and o.state='pending'
      and not exists (select 1 from vx_sub_v2.receipts r where r.order_id=o.id)
  );
$$;
revoke all on function public.vx_sub_v2_may_upload_receipt(uuid) from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_may_upload_receipt(uuid) to authenticated;
commit;
