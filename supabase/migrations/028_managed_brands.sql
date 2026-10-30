-- Additive merchandising metadata; no product prices, stock or permissions change.
alter table public.brands add column display_name text not null default '';
alter table public.brands add column logo_url text not null default '';
alter table public.brands add column description text not null default '';
alter table public.brands add column active boolean not null default true;
insert into brands(id,name) select 'catalogue-'||md5(brand),brand from products where trim(brand)<>'' group by brand on conflict(name) do nothing;

create function public.admin_brand_registry(p_query text default '',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare q text:=left(trim(coalesce(p_query,'')),120);items jsonb;n integer;begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid page';end if;
 select count(*) into n from brands b where q='' or strpos(lower(b.name||' '||b.display_name),lower(q))>0;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into items from (
  select b.*,(select count(*) from products p where p.brand=b.name) product_count from brands b
  where q='' or strpos(lower(b.name||' '||b.display_name),lower(q))>0 order by b.name,b.id limit 50 offset (p_page-1)*50
 ) x;return jsonb_build_object('count',n,'rows',items);
end $$;
create function public.save_brand_registry(p_id text,p_data jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare old brands;canonical text:=trim(p_data->>'name');display text:=trim(coalesce(p_data->>'display_name',''));logo text:=trim(coalesce(p_data->>'logo_url',''));descr text:=coalesce(p_data->>'description','');begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 if p_id is null or length(p_id) not between 1 and 100 or canonical is null or length(canonical) not between 1 and 160 or length(display)>160 or length(logo)>1000 or length(descr)>1000 or logo ~ '[[:cntrl:]]' or (logo<>'' and logo !~ '^https://' and logo !~ '^/[^/]') or jsonb_typeof(p_data->'active') is distinct from 'boolean' then raise exception 'Invalid brand';end if;
 perform pg_advisory_xact_lock(hashtext('edge-brand-registry'));
 select * into old from brands where id=p_id for update;
 if found and old.name<>canonical and exists(select 1 from products where brand=old.name) then raise exception 'This catalogue name is in use. Change the display name to preserve product links.';end if;
 insert into brands(id,name,display_name,logo_url,description,active) values(p_id,canonical,display,logo,descr,(p_data->>'active')::boolean)
 on conflict(id) do update set name=excluded.name,display_name=excluded.display_name,logo_url=excluded.logo_url,description=excluded.description,active=excluded.active;
 perform audit('brand.saved',jsonb_build_object('id',p_id,'name',canonical,'active',p_data->'active'));
end $$;
create function public.published_brands() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.display_name,x.name),'[]'::jsonb) from (
 select b.name,coalesce(nullif(b.display_name,''),b.name) display_name,b.logo_url,b.description,count(p.id) product_count
 from brands b join products p on p.brand=b.name and p.active and p.archived_at is null
 join merchants m on m.id=p.merchant_id and m.status='approved'
 where b.active group by b.id having count(p.id)>0
 ) x
$$;
revoke all on function public.admin_brand_registry(text,integer),public.save_brand_registry(text,jsonb) from public,anon;
grant execute on function public.admin_brand_registry(text,integer),public.save_brand_registry(text,jsonb) to authenticated;
grant execute on function public.published_brands() to anon,authenticated;
