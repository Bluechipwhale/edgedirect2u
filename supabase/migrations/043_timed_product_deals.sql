create table public.product_deals(id uuid primary key,product_id text not null references products(id),kind text not null check(kind in ('flash','day','featured')),title text not null check(length(title) between 2 and 100),price_kobo bigint not null check(price_kobo between 1 and 1000000000),starts_at timestamptz not null,ends_at timestamptz not null,active boolean not null default false,updated_at timestamptz not null default now(),check(ends_at>starts_at and ends_at<=starts_at+interval '90 days'),check(kind<>'day' or ends_at<=starts_at+interval '24 hours'));
alter table product_deals enable row level security;
revoke all on product_deals from public,anon,authenticated;grant select on product_deals to anon,authenticated;
create policy deal_read on product_deals for select using(app_role()='admin' or(active and starts_at<=now() and ends_at>now() and exists(select 1 from products p where p.id=product_id and p.active and p.archived_at is null and approved_merchant(p.merchant_id) and p.price_kobo>product_deals.price_kobo)));
create index product_deal_window_idx on product_deals(product_id,starts_at,ends_at) where active;
create function public.save_product_deal(p_id uuid,p_product text,p_kind text,p_title text,p_price bigint,p_start timestamptz,p_end timestamptz,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
declare base bigint;prior product_deals;begin
 if app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 if p_id is null or p_kind is null or p_kind not in ('flash','day','featured') or length(trim(coalesce(p_title,''))) not between 2 and 100 or p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '90 days' or(p_kind='day' and p_end>p_start+interval '24 hours') or p_price is null or p_price not between 1 and 1000000000 or p_active is null then raise exception 'Enter a valid title, discounted price and time window (deal of the day: at most 24 hours)';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text||'-deal',0));
 select * into prior from product_deals where id=p_id;
 if found and prior.product_id<>p_product then raise exception 'Create a separate deal when changing its product';end if;
 select price_kobo into base from products where id=p_product and archived_at is null for update;
 if not found then raise exception 'Choose a current product';end if;
 if p_active and p_price>=base then raise exception 'Deal price must be lower than the current regular price';end if;
 if p_active and exists(select 1 from product_deals where id<>p_id and product_id=p_product and active and starts_at<p_end and ends_at>p_start) then raise exception 'Another active deal overlaps this product and time window';end if;
 insert into product_deals(id,product_id,kind,title,price_kobo,starts_at,ends_at,active) values(p_id,p_product,p_kind,trim(p_title),p_price,p_start,p_end,p_active)
 on conflict(id) do update set kind=excluded.kind,title=excluded.title,price_kobo=excluded.price_kobo,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,updated_at=now();
 perform audit('deal.saved',jsonb_build_object('id',p_id,'product',p_product,'active',p_active));
end $$;
-- Invoker rights preserve catalogue RLS. The checkout functions retain all
-- existing stock, registered-account and merchant-approval guards.
create function public.effective_product_price(p_product text) returns bigint language sql stable set search_path=public as $$
 select least(p.price_kobo,coalesce((select min(d.price_kobo) from product_deals d where d.product_id=p.id and d.active and d.starts_at<=now() and d.ends_at>now()),p.price_kobo)) from products p where p.id=p_product and p.active and p.archived_at is null and approved_merchant(p.merchant_id)
$$;
create view public.storefront_products with(security_invoker=true) as
 select (jsonb_populate_record(null::products,to_jsonb(p)||jsonb_build_object('price_kobo',coalesce(effective_product_price(p.id),p.price_kobo),'previous_price_kobo',case when effective_product_price(p.id)<p.price_kobo then p.price_kobo else p.previous_price_kobo end))).*,p.price_kobo as regular_price_kobo from products p;
grant select on storefront_products to anon,authenticated;
do $patch$
declare name text;definition text;fragment text:=$match$select * into p from products where id=i->>'product_id';$match$;replacement text:=$new$select * into p from products where id=i->>'product_id';p.price_kobo:=effective_product_price(p.id);if i ? 'expected_price_kobo' and (i->>'expected_price_kobo')::bigint is distinct from p.price_kobo then raise exception 'Prices changed. Refresh your bag prices and review the total before continuing.';end if;$new$;
begin
 foreach name in array array['create_checkout_reserved','reserve_counter_sale'] loop
  definition:=pg_get_functiondef(to_regprocedure('public.'||name||'(jsonb)'));
  if (length(definition)-length(replace(definition,fragment,'')))/length(fragment)<>2 then raise exception 'Unexpected checkout definition; no pricing changes applied';end if;
  execute replace(definition,fragment,replacement);
 end loop;
end $patch$;
revoke all on function save_product_deal(uuid,text,text,text,bigint,timestamptz,timestamptz,boolean) from public,anon;
grant execute on function save_product_deal(uuid,text,text,text,bigint,timestamptz,timestamptz,boolean) to authenticated;
grant execute on function effective_product_price(text) to anon,authenticated;
