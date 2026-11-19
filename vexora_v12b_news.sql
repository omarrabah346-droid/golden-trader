-- ============================================================
-- V12b · أخبار تيليجرام بالأسلوب 3: صورة فيكسورا لكل خبر + «شنو يعني للسوق؟»
-- مهم: ارفع مجلد media/news (17 صورة) على GitHub قبل ما تشغّل هذا الملف.
-- إذا صورة ما انفتحت عند تيليجرام، الخبر ينعاد كنص تلقائياً (ما يضيع).
-- إيقاف الصور بدون رجوع: update public.config set value = '0' where key = 'news_photos';
-- الرجوع الكامل: v12b_news_rollback.sql
-- ============================================================
alter table public.news_outbox add column if not exists photo text;
insert into public.config (key, value, members) values ('news_photos', '1', false) on conflict (key) do nothing;

-- عاجل؟
create or replace function public.news_urgent(t text) returns boolean language sql immutable as $$
  select coalesce(t ~* '(عاجل|يقفز|تقفز|انهيار|ينهار|قياسي|أعلى مستوى|أدنى مستوى|حرب|هجوم|طوارئ)', false) $$;

-- رابط صورة القسم (من الموقع)
create or replace function public.news_photo(k text, urgent boolean) returns text language sql stable set search_path = public as $$
  select case when coalesce(public.cfg('news_photos'), '1') = '0' then null else
    public.news_site('media/news/' ||
      case k when 'gold' then 'gold' when 'fed' then 'rates' when 'rates' then 'rates' when 'fx' then 'fx' when 'oil' then 'oil'
             when 'stocks' then 'stocks' when 'crypto' then 'crypto' when 'cal' then 'cal' when 'result' then 'result' when 'digest' then 'digest' else 'news' end
      || case when urgent and k not in ('cal','result','digest') then '-u' else '' end || '.jpg?v=1') end $$;

-- «شنو يعني للسوق؟» من القياسات الحقيقية بس (5 مرات أو أكثر بنفس الاتجاه)
create or replace function public.news_meaning(e public.econ_events) returns text language plpgsql stable set search_path = public as $$
declare c text := public.news_cmp(e.actual, e.forecast); sg int; n int; dn int; up int; nm text;
begin
  if c not in ('up','down') then return ''; end if;
  sg := case when c = 'up' then 1 else -1 end;
  select count(*), count(*) filter (where (reacts->'XAU/USD'->>'m60')::numeric < 0), count(*) filter (where (reacts->'XAU/USD'->>'m60')::numeric > 0)
    into n, dn, up
  from public.news_reactions where title = e.title and country = e.country and done and surprise_sign = sg and reacts->'XAU/USD'->>'m60' is not null and event_id <> e.id;
  if n < 5 then return ''; end if;
  nm := coalesce(nullif(e.title_ar,''), nullif(public.econ_ar(e.title),''), e.title);
  return '<blockquote>🧭 <b>شنو يعني للسوق؟</b>' || chr(10) || 'تاريخياً، لما يطلع ' || public.h(nm) || ' ' || case when sg = 1 then 'أعلى' else 'أقل' end
      || ' من المتوقع، الذهب ' || case when dn >= up then 'نزل' else 'صعد' end || ' بأول ساعة <b>' || greatest(dn, up) || ' من ' || n || '</b> مرات.' || chr(10)
      || '<i>إحصائية من قياسات سابقة، وليست توقع أكيد.</i></blockquote>';
end $$;

-- 1) الأخبار التلقائية: تنحط بطابور الإرسال ويّا صورة القسم
CREATE OR REPLACE FUNCTION public.news_process()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  r      record;
  doc    xml;
  it     xml;
  ttl    text;
  lnk    text;
  tok    text;
  chat   text;
  kw     text[];
  firstr boolean;
  ttls   text[];
  lnks   text[];
  sent   int := 0;
  i      int;
  dup    boolean;
begin
  select value into tok  from public.config where key = 'tg_token';
  select value into chat from public.config where key = 'tg_news';

  for r in
    select q.request_id, q.feed_id, f.name, f.keywords, resp.status_code, resp.content
    from public.news_requests q
    join public.news_feeds f on f.id = q.feed_id
    join net._http_response resp on resp.id = q.request_id
    order by q.created_at
  loop
    delete from public.news_requests where request_id = r.request_id;
    continue when r.status_code is distinct from 200 or r.content is null;

    begin
      doc := xmlparse(document regexp_replace(r.content, '^[\s﻿]+', ''));
    exception when others then
      continue;
    end;

    firstr := not exists (select 1 from public.news_seen where feed_id = r.feed_id);
    kw := array_remove(string_to_array(lower(r.keywords), ','), '');
    ttls := '{}';
    lnks := '{}';

    for it in
      select x from unnest(xpath('//*[local-name()="item" or local-name()="entry"]', doc)) as x limit 20
    loop
      ttl := public.news_clean((xpath('/*/*[local-name()="title"]/text()', it))[1]::text);
      lnk := coalesce((xpath('/*/*[local-name()="link"]/text()', it))[1]::text,
                      (xpath('/*/*[local-name()="link"]/@href', it))[1]::text);
      lnk := btrim(replace(coalesce(lnk, ''), '&amp;', '&'));
      continue when lnk = '' or ttl = '';
      continue when exists (select 1 from public.news_seen where link = lnk);

      -- نفس الخبر من جريدة ثانية خلال 12 ساعة؟ نحفظه بدون إرسال
      dup := exists (select 1 from public.news_seen s
                     where s.seen_at > now() - interval '12 hours'
                       and extensions.similarity(s.title, ttl) > 0.45);

      insert into public.news_seen (link, feed_id, title, cat) values (lnk, r.feed_id, ttl, public.news_cat(ttl))
      on conflict (link) do nothing;

      if not firstr and not dup and (cardinality(kw) = 0 or exists (
          select 1 from unnest(kw) k where lower(ttl) like '%' || btrim(k) || '%')) then
        ttls := array_prepend(ttl, ttls);
        lnks := array_prepend(lnk, lnks);
      end if;
    end loop;

    if coalesce(tok, '') <> '' and coalesce(chat, '') <> '' then
      for i in 1 .. coalesce(array_length(ttls, 1), 0) loop
        exit when sent >= 6;
        insert into public.news_outbox (kind, target, chat, body, kb, photo) values ('headline', 'channel', chat,
          public.news_format(ttls[i], lnks[i]),
          jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
            jsonb_build_object('text', '📰 المصدر', 'url', lnks[i]),
            jsonb_build_object('text', case when public.news_cat(ttls[i]) = 'gold' then '📊 الذهب على فيكسورا' else '🌐 فيكسورا' end, 'url', public.news_site(''))))),
          public.news_photo(public.news_cat(ttls[i]), public.news_urgent(ttls[i])));
        update public.news_seen set posted = true where link = lnks[i];
        sent := sent + 1;
      end loop;
    end if;
  end loop;

  delete from public.news_seen where seen_at < now() - interval '30 days';
end $function$;

-- 2) ملخص اليوم ويّا صورة
CREATE OR REPLACE FUNCTION public.news_digest()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tok text; chat text; msg text; c record; t record; e record; n int := 0; nl text := chr(10); head text; pos int; tm text := '';
  tz text := 'Asia/Baghdad'; d1 date := (now() at time zone 'Asia/Baghdad')::date + 1;
  cur text[] := string_to_array(replace(coalesce(public.cfg('cal_currencies'),''), ' ', ''), ',');
begin
  select value into tok  from public.config where key = 'tg_token';
  select value into chat from public.config where key = 'tg_news';
  if coalesce(tok, '') = '' or coalesce(chat, '') = '' then return; end if;
  msg := '<b>🗞 ملخص الأسواق · ' || to_char(now() at time zone tz, 'DD/MM') || '</b>' || nl;
  for c in select cat from (values ('gold',1),('fed',2),('fx',3),('oil',4),('stocks',5),('crypto',6)) v(cat, ord) order by ord loop
    for t in select title from public.news_seen where cat = c.cat and seen_at > now() - interval '24 hours' order by posted desc, seen_at desc limit 2 loop
      head := t.title; pos := strpos(head, ' - ');
      if pos > 15 then head := btrim(left(head, pos - 1)); end if;
      msg := msg || nl || '<code>' || rpad(split_part(public.news_tag(c.cat), ' · ', 1), 6) || public.news_dir(head) || '</code> ' || head;
      n := n + 1;
    end loop;
  end loop;
  if n = 0 then return; end if;
  for e in select * from public.econ_events
           where status = 'upcoming' and (at at time zone tz)::date = d1 and public.news_imp_rank(impact) >= public.news_imp_rank('Medium')
             and (country = any(cur) or manual or cardinality(cur) = 0)
           order by at limit 5 loop
    tm := tm || nl || '‏' || public.news_flag(e.country) || ' ' || to_char(e.at at time zone tz, 'HH24:MI') || ' '
       || public.h(coalesce(nullif(e.title_ar,''), nullif(public.econ_ar(e.title),''), e.title)) || ' <code>' || public.news_imp_code(e.impact) || '</code>';
  end loop;
  if tm <> '' then msg := msg || nl || nl || '<b>باچر:</b>' || tm; end if;
  insert into public.news_outbox (kind, target, chat, body, kb, photo) values ('digest', 'channel', chat, msg,
    jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
      jsonb_build_object('text', '📅 التقويم على فيكسورا', 'url', public.news_site('app.html#news')),
      jsonb_build_object('text', '🌐 فيكسورا', 'url', public.news_site(''))))),
    public.news_photo('digest', false));
end $function$;

-- 3) التذكير والنتيجة ويّا صورة + «شنو يعني للسوق؟»
CREATE OR REPLACE FUNCTION public.news_dispatch()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  leads int[] := coalesce((select array_agg(trim(x)::int order by trim(x)::int desc) from unnest(string_to_array(public.cfg('news_rem'), ',')) x where trim(x) ~ '^\d+$'), '{}');
  minr int := public.news_imp_rank(coalesce(nullif(public.cfg('news_min_imp'),''),'High'));
  cur text[] := string_to_array(replace(public.cfg('cal_currencies'), ' ', ''), ',');
  on_ch boolean := public.cfg('cal_alerts') = '1';
  grp record; ld int; msg text; ch text; ob bigint; n int := 0; nl text := chr(10); u record; ev public.econ_events; lines text; ids text[]; kb jsonb;
begin
  -- (أ) تذكيرات القناة: نجمع الأحداث اللي بنفس الدقيقة برسالة وحدة، وكل نوع مرة وحدة
  if on_ch then
    foreach ld in array leads loop
      for grp in
        select e.at, array_agg(e.id order by e.country, e.title) ids, string_agg(public.news_line(e) || ' · <code>' || public.news_imp_code(e.impact) || '</code>' || nl || '<pre>'
               || 'Forecast   ' || coalesce(nullif(public.h(e.forecast),''),'—') || nl || 'Previous   ' || coalesce(nullif(public.h(e.previous),''),'—')
               || public.news_hist(e.title, e.country) || '</pre>', nl order by e.country, e.title) lines, bool_or(e.country = 'USD') usd, min(e.id) first_id
        from public.econ_events e
        where e.status = 'upcoming' and public.news_imp_rank(e.impact) >= minr and (e.country = any(cur) or e.manual)
          and now() >= e.at - make_interval(mins => ld) and now() < e.at - make_interval(mins => ld) + interval '10 minutes' and e.at > now()
          and not exists (select 1 from public.news_sends s where s.event_id = e.id and s.target = 'channel' and (s.kind = 'r' || ld or (s.kind like 'r%' and s.created_at > now() - interval '12 minutes')))
        group by e.at order by e.at
      loop
        msg := '<b>⏰ بعد ' || greatest(1, round(extract(epoch from grp.at - now()) / 60))::int || ' دقيقة · ' || to_char(grp.at at time zone 'Asia/Baghdad', 'HH24:MI') || ' بغداد</b>' || nl
          || grp.lines || nl || '‏🛑 لا دخول قبل الخبر بـ 15 دقيقة، وخلي الوقف بمكانه';
        kb := jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
                jsonb_build_object('text', '⏱ العداد على فيكسورا', 'url', public.news_link(grp.first_id)))));
        foreach ch in array public.news_chats() loop
          insert into public.news_outbox (kind, target, chat, body, event_ids, kb, photo) values ('r' || ld, 'channel', ch, msg, grp.ids, kb, public.news_photo('cal', false)) returning id into ob;
        end loop;
        insert into public.news_sends (event_id, kind, target, outbox_id) select x, 'r' || ld, 'channel', ob from unnest(grp.ids) x on conflict do nothing;
        update public.econ_events set alerted = true where id = any(grp.ids);
        n := n + 1;
      end loop;
    end loop;

    -- (ب) النتيجة الفعلية بالقناة
    if public.cfg('news_result') = '1' then
      for grp in
        select e.at, array_agg(e.id) ids, min(e.id) first_id,
               string_agg(public.news_line(e) || nl || '<pre>'
                 || 'Actual     ' || public.h(e.actual) || case public.news_cmp(e.actual, e.forecast) when 'up' then '  ▲ beat' when 'down' then '  ▼ miss' when 'eq' then '  ■ in line' else '' end
                 || nl || 'Forecast   ' || coalesce(nullif(public.h(e.forecast),''),'—') || nl || 'Previous   ' || coalesce(nullif(public.h(e.previous),''),'—') || '</pre>', nl order by e.country, e.title) lines,
               string_agg(distinct e.source, ', ') src, max(e.actual_at) upd
        from public.econ_events e
        where e.status = 'released' and e.actual <> '' and e.actual_at > now() - interval '3 hours'
          and public.news_imp_rank(e.impact) >= minr and (e.country = any(cur) or e.manual)
          and not exists (select 1 from public.news_sends s where s.event_id = e.id and s.kind = 'result' and s.target = 'channel')
        group by e.at order by e.at
      loop
        msg := '<b>✅ صدرت النتيجة · ' || to_char(grp.upd at time zone 'Asia/Baghdad', 'HH24:MI') || ' بغداد</b>' || nl || grp.lines || nl
          || '<code>المصدر: ' || public.h(grp.src) || '</code>'
          || coalesce((select nl || public.news_meaning(x) from public.econ_events x where x.id = grp.first_id and public.news_meaning(x) <> ''), '');
        kb := jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
                jsonb_build_object('text', '📊 ردة الفعل على فيكسورا', 'url', public.news_link(grp.first_id)))));
        foreach ch in array public.news_chats() loop
          insert into public.news_outbox (kind, target, chat, body, event_ids, kb, photo) values ('result', 'channel', ch, msg, grp.ids, kb, public.news_photo('result', false)) returning id into ob;
        end loop;
        insert into public.news_sends (event_id, kind, target, outbox_id) select x, 'result', 'channel', ob from unnest(grp.ids) x on conflict do nothing;
        n := n + 1;
      end loop;
    end if;
  end if;

  -- (ج) التنبيهات الشخصية (داخل الموقع + تيليجرام الخاص) — رسالة وحدة لكل مستخدم بكل دورة
  for u in
    select p.*, t.chat_id, t.active tg_ok, coalesce(nullif(pr.lang,''),'ar') lang
    from public.news_prefs p join public.profiles pr on pr.id = p.user_id
    left join public.news_tg t on t.user_id = p.user_id
    where not p.paused and (p.in_site or (p.tg and t.active))
  loop
    for ld in select unnest(u.leads) loop
      lines := null; ids := null;
      select string_agg(public.news_line(e, u.lang = 'en'), nl order by e.at), array_agg(e.id) into lines, ids
      from public.econ_events e
      where e.status = 'upcoming' and e.impact = any(u.impacts) and (e.country = any(u.ccys) or ('XAU' = any(u.ccys) and e.country = 'USD'))
        and now() >= e.at - make_interval(mins => ld) and now() < e.at - make_interval(mins => ld) + interval '10 minutes' and e.at > now()
        and not exists (select 1 from public.news_sends s where s.event_id = e.id and s.target = u.user_id::text and s.kind like 'r%' and (s.kind = 'r' || ld or s.created_at > now() - interval '12 minutes'));
      continue when ids is null;
      insert into public.news_sends (event_id, kind, target) select x, 'r' || ld, u.user_id::text from unnest(ids) x on conflict do nothing;
      if u.in_site then
        insert into public.notifications (user_id, icon, title, body, link, kind, dkey)
        values (u.user_id, '⏰', case when u.lang = 'en' then 'Economic news in ' || ld || ' min' else 'خبر اقتصادي بعد ' || ld || ' دقيقة' end,
                regexp_replace(replace(lines, '‏', ''), '<[^>]+>', '', 'g'), 'app.html#news/ev/' || ids[1], 'news', 'nw:' || ids[1] || ':r' || ld || ':' || u.user_id)
        on conflict do nothing;
      end if;
      if u.tg and u.tg_ok then
        insert into public.news_outbox (kind, target, chat, body, event_ids) values ('r' || ld, u.user_id::text, u.chat_id::text,
          case when u.lang = 'en' then '⏰ <b>Economic news in ' || ld || ' min</b>' else '‏⏰ <b>خبر اقتصادي بعد ' || ld || ' دقيقة</b>' end || nl || nl || lines || nl || nl
          || '🔗 <a href="' || public.news_link(ids[1]) || '">' || case when u.lang = 'en' then 'Details' else 'التفاصيل' end || '</a>', ids);
      end if;
      n := n + 1;
    end loop;
    if u.on_result then
      lines := null; ids := null;
      select string_agg(public.news_line(e, u.lang = 'en') || ': <b>' || public.h(e.actual) || '</b> (' || case when u.lang = 'en' then 'f ' else 'المتوقع ' end || coalesce(nullif(public.h(e.forecast),''),'—') || ')', nl), array_agg(e.id) into lines, ids
      from public.econ_events e
      where e.status = 'released' and e.actual <> '' and e.actual_at > now() - interval '3 hours'
        and e.impact = any(u.impacts) and (e.country = any(u.ccys) or ('XAU' = any(u.ccys) and e.country = 'USD'))
        and not exists (select 1 from public.news_sends s where s.event_id = e.id and s.target = u.user_id::text and s.kind = 'result');
      if ids is not null then
        insert into public.news_sends (event_id, kind, target) select x, 'result', u.user_id::text from unnest(ids) x on conflict do nothing;
        if u.in_site then
          insert into public.notifications (user_id, icon, title, body, link, kind, dkey)
          values (u.user_id, '✅', case when u.lang = 'en' then 'Result released' else 'صدرت النتيجة' end,
                  regexp_replace(replace(lines, '‏', ''), '<[^>]+>', '', 'g'), 'app.html#news/ev/' || ids[1], 'news', 'nw:' || ids[1] || ':res:' || u.user_id)
          on conflict do nothing;
        end if;
        if u.tg and u.tg_ok then
          insert into public.news_outbox (kind, target, chat, body, event_ids) values ('result', u.user_id::text, u.chat_id::text,
            '✅ <b>' || case when u.lang = 'en' then 'Result released' else 'صدرت النتيجة' end || '</b>' || nl || nl || lines || nl || nl
            || '🔗 <a href="' || public.news_link(ids[1]) || '">' || case when u.lang = 'en' then 'Details' else 'التفاصيل' end || '</a>', ids);
        end if;
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $function$;

-- 4) الإرسال: صورة مع النص، وإذا فشلت الصورة يرجع نص
CREATE OR REPLACE FUNCTION public.news_send()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r record; rid bigint; n int := 0; lim int := greatest(1, coalesce(nullif(public.cfg('news_rate'),'')::int, 25)); rsp record;
begin
  -- 1) نتائج الطلبات السابقة
  for r in select * from public.news_outbox where status = 'sending' and req_id is not null loop
    select status_code, content into rsp from net._http_response where id = r.req_id;
    if found then
      if rsp.status_code = 200 then
        update public.news_outbox set status = 'sent', sent_at = now() where id = r.id;
        if r.target = 'channel' then
          insert into public.econ_updates (event_id, kind, changes)
          select x, 'sent', jsonb_build_object('kind', r.kind, 'chat', r.chat) from unnest(r.event_ids) x where exists (select 1 from public.econ_events where id = x);
        end if;
      else
        if r.photo is not null and rsp.status_code = 400 then
          -- الصورة ما انفتحت عند تيليجرام: نعيد الإرسال كنص حتى ما يضيع الخبر
          update public.news_outbox set status = 'queued', req_id = null, photo = null, created_at = now(),
                 err = 'photo→text: ' || left(coalesce(rsp.content, ''), 200) where id = r.id;
        else
        update public.news_outbox set status = 'failed', err = left(coalesce(rsp.content, 'HTTP ' || rsp.status_code), 300) where id = r.id;
        end if;
        if rsp.status_code = 403 and r.target <> 'channel' then update public.news_tg set active = false where chat_id::text = r.chat; end if;
      end if;
    elsif r.sent_at is null and r.created_at < now() - interval '10 minutes' then
      update public.news_outbox set status = 'failed', err = 'timeout' where id = r.id;
    end if;
  end loop;
  -- 2) إرسال جديد
  if public.cfg('tg_token') = '' then
    update public.news_outbox set status = 'failed', err = 'TG_TOKEN_MISSING' where status = 'queued' and created_at < now() - interval '30 minutes';
    return 0;
  end if;
  for r in select * from public.news_outbox where status = 'queued' order by (target = 'channel') desc, id limit lim for update skip locked loop
    if r.photo is not null and char_length(regexp_replace(r.body, '<[^>]+>', '', 'g')) <= 1000 then
      rid := public.tg_call('sendPhoto', jsonb_build_object('chat_id', r.chat, 'photo', r.photo, 'caption', r.body, 'parse_mode', 'HTML')
             || case when r.kb is not null then jsonb_build_object('reply_markup', r.kb) else '{}'::jsonb end);
    else
      rid := public.tg_call('sendMessage', jsonb_build_object('chat_id', r.chat, 'text', r.body, 'parse_mode', 'HTML', 'disable_web_page_preview', true)
             || case when r.kb is not null then jsonb_build_object('reply_markup', r.kb) else '{}'::jsonb end);
    end if;
    update public.news_outbox set status = 'sending', req_id = rid where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $function$;

-- 5) نشر خبر يدوي من لوحة الإدارة (بتحليل «شنو يعني للسوق؟»)
create or replace function public.admin_news_post(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text := coalesce(nullif(p->>'cat',''), 'news'); urg boolean := coalesce((p->>'urgent')::boolean, false);
  ttl text := btrim(coalesce(p->>'title','')); mean text := btrim(coalesce(p->>'meaning','')); src text := btrim(coalesce(p->>'src',''));
  url text := btrim(coalesce(p->>'url','')); tags text := btrim(coalesce(p->>'tags','')); dry boolean := coalesce((p->>'dry')::boolean, false);
  msg text; kb jsonb; ph text; ch text; n int := 0; nl text := chr(10); chats text[];
begin
  if not public.has_perm('news') then raise exception 'FORBIDDEN'; end if;
  if ttl = '' then raise exception 'REQUIRED: اكتب عنوان الخبر'; end if;
  if char_length(ttl) > 220 then raise exception 'TOO_LONG: العنوان طويل (220 حرف حد أقصى)'; end if;
  if char_length(mean) > 500 then raise exception 'TOO_LONG: التحليل طويل (500 حرف حد أقصى)'; end if;
  if url <> '' and url !~* '^https?://' then raise exception 'BAD_URL: الرابط لازم يبدي بـ https://'; end if;
  if k not in ('gold','rates','fx','oil','stocks','crypto','news') then raise exception 'BAD_CAT'; end if;
  msg := case when urg then '⚡️ <b>عاجل | ' || split_part(public.news_tag(case k when 'rates' then 'fed' when 'news' then 'other' else k end), ' · ', 1) || '</b>' || nl else '' end
      || '<b>' || public.h(ttl) || '</b>'
      || case when mean <> '' then nl || nl || '<blockquote>🧭 <b>شنو يعني للسوق؟</b>' || nl || public.h(mean) || '</blockquote>' else '' end
      || nl || '<code>' || concat_ws(' · ', nullif(public.h(tags),''), nullif(public.h(src),''), to_char(now() at time zone 'Asia/Baghdad', 'HH24:MI')) || '</code>';
  kb := jsonb_build_object('inline_keyboard', jsonb_build_array(
          case when url <> '' then jsonb_build_array(jsonb_build_object('text', '📰 المصدر', 'url', url),
                                                     jsonb_build_object('text', case when k = 'gold' then '📈 شارت الذهب على فيكسورا' else '🌐 فيكسورا' end, 'url', public.news_site('')))
               else jsonb_build_array(jsonb_build_object('text', case when k = 'gold' then '📈 شارت الذهب على فيكسورا' else '🌐 فيكسورا' end, 'url', public.news_site(''))) end));
  ph := public.news_photo(k, urg);
  if dry then return jsonb_build_object('body', msg, 'kb', kb, 'photo', ph); end if;
  if public.cfg('tg_token') = '' then raise exception 'TG_TOKEN_MISSING: توكن البوت مو مضاف بالسيرفر'; end if;
  chats := case when coalesce(public.cfg('tg_news'),'') <> '' then string_to_array(replace(public.cfg('tg_news'),' ',''), ',') else public.news_chats() end;
  if coalesce(array_length(chats, 1), 0) = 0 then raise exception 'NO_CHANNEL: حدد قناة الأخبار'; end if;
  foreach ch in array chats loop
    continue when ch = '';
    insert into public.news_outbox (kind, target, chat, body, kb, photo) values ('manual', 'channel', ch, msg, kb, ph);
    n := n + 1;
  end loop;
  perform public.news_send();
  perform public.log_admin('نشر خبر يدوي بالقناة', 'news_post', jsonb_build_object('title', left(ttl, 120), 'cat', k, 'urgent', urg, 'chats', n));
  return jsonb_build_object('queued', n, 'body', msg, 'photo', ph);
end $$;
revoke all on function public.admin_news_post(jsonb) from public, anon;
grant execute on function public.admin_news_post(jsonb) to authenticated;
revoke all on function public.news_meaning(public.econ_events), public.news_photo(text, boolean) from public, anon, authenticated;

-- فحص (ما يرسل شي): لازم يطلع رابط صورة الذهب
select public.news_photo('gold', true) as photo_check;
