insert into vx_sub_v2.owner_identity values(true,'00000000-0000-4000-8000-000000000001');
insert into vx_sub_v2.enrollment
select format('00000000-0000-4000-8000-00000000000%s',n)::uuid,
       case n when 3 then '00000000-0000-4000-8000-000000000011'::uuid
         else '00000000-0000-4000-8000-000000000010'::uuid end
from generate_series(2,4) n;
