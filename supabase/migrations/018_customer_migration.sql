-- Preserve customer records from the owner's former store without creating
-- passwords, unconfirmed Auth accounts, or pretending old orders were paid here.
create table public.legacy_customers (
  source_id text primary key check(length(source_id) between 1 and 100),
  source_site text not null default 'edgedirect2u.com.ng' check(source_site='edgedirect2u.com.ng'),
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text not null default '',
  address jsonb not null default '{}'::jsonb check(jsonb_typeof(address)='object'),
  route text not null default '',
  legacy_order_count integer check(legacy_order_count>=0),
  blocked boolean,
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  source_checksum text not null check(source_checksum ~ '^[a-f0-9]{64}$'),
  linked_user_id uuid unique references public.profiles(id) on delete set null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(email is null or (email=lower(trim(email)) and length(email)<=254))
);
create index legacy_customers_email_idx on public.legacy_customers(email) where email is not null;
create index legacy_customers_name_idx on public.legacy_customers(lower(first_name),lower(last_name));
alter table public.legacy_customers enable row level security;
revoke all on public.legacy_customers from public,anon,authenticated;

-- Only authenticated administrators may list imported private contacts. The
-- underlying table has no direct browser grants, including for admin sessions.
create function public.admin_legacy_customers(p_query text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=left(trim(coalesce(p_query,'')),120);n integer;items jsonb;begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page';end if;
 select count(*) into n from legacy_customers c
 where q='' or c.source_id ilike '%'||q||'%' or c.first_name ilike '%'||q||'%'
 or c.last_name ilike '%'||q||'%' or c.email ilike '%'||q||'%' or c.phone ilike '%'||q||'%';
 select coalesce(jsonb_agg(to_jsonb(x) order by x.source_id),'[]'::jsonb) into items from (
  select c.source_id,c.first_name,c.last_name,c.email,c.phone,c.address,c.route,
   c.legacy_order_count,c.blocked,c.details,c.linked_user_id,c.imported_at
  from legacy_customers c
  where q='' or c.source_id ilike '%'||q||'%' or c.first_name ilike '%'||q||'%'
   or c.last_name ilike '%'||q||'%' or c.email ilike '%'||q||'%' or c.phone ilike '%'||q||'%'
  order by c.source_id limit 50 offset (p_page-1)*50
 ) x;
 return jsonb_build_object('count',n,'rows',items,
  'linked_count',(select count(*) from legacy_customers where linked_user_id is not null),
  'missing_email_count',(select count(*) from legacy_customers where email is null),
  'legacy_unverified_count',(select count(*) from legacy_customers where details->>'legacy_verified'='false'),
  'truncated_name_count',(select count(*) from legacy_customers where details->>'truncated_name'='true'));
end $$;

create function public.admin_legacy_customers_export() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'source_id',c.source_id,'name',trim(c.first_name||' '||c.last_name),
  'email',coalesce(c.email,c.details->>'unusable_legacy_email',''),
  'phone',c.phone,'route',c.route,'legacy_order_count',c.legacy_order_count,
  'legacy_verified',c.details->>'legacy_verified'='true',
  'truncated_name',c.details->>'truncated_name'='true',
  'linked',c.linked_user_id is not null,
  'street',c.address->>'street','city',c.address->>'city','state',c.address->>'state'
 ) order by c.source_id) from legacy_customers c),'[]'::jsonb);
end $$;

-- An old record can be linked only to a confirmed account with the same
-- unique email address. Ambiguous/absent emails remain for admin review.
create function public.claim_legacy_customer() returns jsonb language plpgsql security definer set search_path=public as $$
declare u jsonb;e text;c legacy_customers;n integer;aid text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select to_jsonb(x) into u from auth.users x where x.id=auth.uid();
 if u->>'email_confirmed_at' is null or coalesce((u->>'is_anonymous')::boolean,false) then return jsonb_build_object('claimed',false);end if;
 e:=lower(trim(coalesce(u->>'email','')));
 if e='' then return jsonb_build_object('claimed',false);end if;
 select count(*) into n from legacy_customers where email=e;
 if n<>1 then return jsonb_build_object('claimed',false,'ambiguous',n>1);end if;
 select * into c from legacy_customers where email=e for update;
 if c.details->>'legacy_verified' is distinct from 'true' then
  return jsonb_build_object('claimed',false,'manual_review',true);
 end if;
 if c.linked_user_id is not null and c.linked_user_id<>auth.uid() then return jsonb_build_object('claimed',false,'conflict',true);end if;
 if c.linked_user_id is null then
  update legacy_customers set linked_user_id=auth.uid(),updated_at=now() where source_id=c.source_id;
  update profiles set name=left(trim(c.first_name||' '||c.last_name),160)
   where id=auth.uid() and trim(name)='';
  aid:='legacy-edgedirect2u-'||c.source_id;
  if length(aid)<=120 and length(trim(coalesce(c.address->>'street','')))>0
   and length(trim(coalesce(c.address->>'city','')))>0 and length(trim(coalesce(c.address->>'state','')))>0 then
   insert into addresses(id,owner_id,name,phone,street,city,state)
   values(aid,auth.uid(),left(trim(c.first_name||' '||c.last_name),160),c.phone,
    c.address->>'street',c.address->>'city',c.address->>'state')
   on conflict(id) do nothing;
  end if;
  perform audit('legacy.customer.claim',jsonb_build_object('source_id',c.source_id));
 end if;
 return jsonb_build_object('claimed',true);
end $$;

revoke all on function public.admin_legacy_customers(text,integer),public.admin_legacy_customers_export(),public.claim_legacy_customer() from public,anon;
grant execute on function public.admin_legacy_customers(text,integer),public.admin_legacy_customers_export(),public.claim_legacy_customer() to authenticated;
