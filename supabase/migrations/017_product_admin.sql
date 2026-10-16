-- Administrators can manage every catalogue row while retaining order and stock history.
-- Removing a product archives it; restoration preserves its former publication state.
alter table public.products add column archived_at timestamptz;
alter table public.products add column archived_by uuid references public.profiles(id);
alter table public.products add column archived_previous_active boolean not null default false;
alter table public.products add constraint products_archived_inactive check (archived_at is null or not active);
create index products_archive_recent_idx on public.products(archived_at,created_at desc);

drop policy products_read on public.products;
create policy products_read on public.products for select using
  ((active and archived_at is null and approved_merchant(merchant_id)) or is_staff() or merchant_id=current_merchant());

create or replace function public.save_product(p_id text,p_data jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare existing products;owner text:=p_data->>'merchant_id';
begin
  select * into existing from products where id=p_id for update;
  if existing.archived_at is not null then raise exception 'Restore product before editing';end if;
  if app_role()='merchant' then
    owner:=current_merchant();
    if existing.id is not null and existing.merchant_id<>owner then raise exception 'Forbidden';end if;
    if not exists(select 1 from merchants where id=owner and status='approved') then raise exception 'Merchant approval required';end if;
  elsif app_role()<>'admin' then raise exception 'Forbidden';end if;
  insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,previous_price_kobo,image,images,description,options,featured,active)
    values(p_id,p_data->>'slug',p_data->>'name',p_data->>'category_id',p_data->>'brand',owner,
      (select name from merchants where id=owner),(p_data->>'price_kobo')::bigint,(p_data->>'previous_price_kobo')::bigint,
      p_data->>'image',coalesce(p_data->'images','[]'),p_data->>'description',coalesce(p_data->'options','{}'),
      coalesce((p_data->>'featured')::boolean,false),coalesce((p_data->>'active')::boolean,true))
    on conflict(id) do update set slug=excluded.slug,name=excluded.name,category_id=excluded.category_id,
      brand=excluded.brand,merchant_id=excluded.merchant_id,merchant_name=excluded.merchant_name,
      price_kobo=excluded.price_kobo,previous_price_kobo=excluded.previous_price_kobo,image=excluded.image,
      images=excluded.images,description=excluded.description,options=excluded.options,featured=excluded.featured,
      active=excluded.active;
  perform audit('products.saved',jsonb_build_object('id',p_id));
end $$;

create function public.admin_product_catalogue(p_query text default '',p_state text default 'all',p_owner text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=lower(trim(coalesce(p_query,'')));result jsonb;
begin
  if app_role()<>'admin' then raise exception 'Forbidden';end if;
  if length(q)>120 or length(coalesce(p_owner,''))>100 or p_page not between 1 and 100000 then raise exception 'Invalid catalogue search';end if;
  if p_state not in ('all','active','draft','archived') then raise exception 'Invalid product state';end if;
  with matches as (
    select p.* from products p
    where (q='' or position(q in lower(concat_ws(' ',p.name,p.brand,p.slug,p.id,p.merchant_name)))>0)
      and (coalesce(p_owner,'')='' or p.merchant_id=p_owner)
      and (p_state='all'
        or (p_state='active' and p.active and p.archived_at is null)
        or (p_state='draft' and not p.active and p.archived_at is null)
        or (p_state='archived' and p.archived_at is not null))
  ), page_rows as (
    select * from matches order by created_at desc,id desc limit 25 offset (p_page-1)*25
  )
  select jsonb_build_object(
    'count',(select count(*) from matches),
    'products',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from page_rows r),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.set_product_archived(p_id text,p_archive boolean) returns void
language plpgsql security definer set search_path=public as $$
declare p products;
begin
  if app_role()<>'admin' then raise exception 'Forbidden';end if;
  if p_archive is null then raise exception 'Invalid archive action';end if;
  select * into p from products where id=p_id for update;
  if not found then raise exception 'Product not found';end if;
  if p_archive and p.archived_at is null then
    update products set archived_at=now(),archived_by=auth.uid(),archived_previous_active=active,active=false where id=p_id;
    perform audit('products.archived',jsonb_build_object('id',p_id,'was_active',p.active));
  elsif not p_archive and p.archived_at is not null then
    update products set active=archived_previous_active,archived_at=null,archived_by=null,archived_previous_active=false where id=p_id;
    perform audit('products.restored',jsonb_build_object('id',p_id,'active',p.archived_previous_active));
  end if;
end $$;

revoke execute on function public.admin_product_catalogue(text,text,text,integer),public.set_product_archived(text,boolean) from public,anon;
grant execute on function public.admin_product_catalogue(text,text,text,integer),public.set_product_archived(text,boolean) to authenticated;
