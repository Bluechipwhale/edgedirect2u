-- An isolated historical archive. Nothing here creates a live order, payment,
-- balance, stock movement, staff login, subscription or customer notification.
create table public.legacy_history_batches (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 source_site text not null check(source_site='edgedirect2u.com.ng'),
 snapshot_date date not null,
 counts jsonb not null check(jsonb_typeof(counts)='object'),
 reconciliation jsonb not null check(jsonb_typeof(reconciliation)='object'),
 imported_at timestamptz not null default now(),
 verified_at timestamptz
);
create table public.legacy_history_records (
 batch_id text not null references public.legacy_history_batches(id),
 source_table text not null check(source_table ~ '^[a-z][a-z0-9_]{0,63}$'),
 source_id text not null check(length(source_id) between 1 and 150),
 data jsonb not null check(jsonb_typeof(data)='object'),
 checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 primary key(batch_id,source_table,source_id)
);
alter table public.legacy_history_batches enable row level security;
alter table public.legacy_history_records enable row level security;
revoke all on public.legacy_history_batches,public.legacy_history_records from public,anon,authenticated;

create function public.admin_legacy_history(p_table text default 'orders',p_page integer default 1,p_query text default '',p_batch text default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare b legacy_history_batches;q text:=left(trim(coalesce(p_query,'')),120);n integer;items jsonb;begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 if p_page is null or p_page<1 or p_page>100000 or p_limit is null or p_limit<1 or p_limit>1000 then raise exception 'Invalid pagination';end if;
 select * into b from legacy_history_batches where verified_at is not null and (p_batch is null or id=p_batch) order by snapshot_date desc,imported_at desc,id desc limit 1;
 if b.id is null then return jsonb_build_object('batch',null,'count',0,'rows','[]'::jsonb);end if;
 if p_table is null or not (b.counts ? p_table) then raise exception 'Unknown source table';end if;
 select count(*) into n from legacy_history_records r where r.batch_id=b.id and r.source_table=p_table
  and (q='' or strpos(lower(r.source_id),lower(q))>0 or strpos(lower(r.data::text),lower(q))>0);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.source_id),'[]'::jsonb) into items from (
  select r.source_id,r.data,r.checksum from legacy_history_records r where r.batch_id=b.id and r.source_table=p_table
   and (q='' or strpos(lower(r.source_id),lower(q))>0 or strpos(lower(r.data::text),lower(q))>0)
  order by r.source_id limit p_limit offset (p_page-1)*p_limit
 ) x;
 return jsonb_build_object('batch',to_jsonb(b),'count',n,'rows',items);
end $$;
revoke all on function public.admin_legacy_history(text,integer,text,text,integer) from public,anon;
grant execute on function public.admin_legacy_history(text,integer,text,text,integer) to authenticated;
