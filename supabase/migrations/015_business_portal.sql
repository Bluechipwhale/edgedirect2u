-- Flagship business operations. These roles never expand legacy is_staff().
create table public.business_principals(id text primary key,name text not null);
create table public.business_access(
 email text primary key check(email=lower(trim(email))),
 role text not null check(role in ('warehouse_manager','it_manager','accounts','client','van_sales')),
 principal_id text references business_principals(id), active boolean not null default true,
 user_id uuid unique references profiles(id), prior_role text,
 approved_by uuid references profiles(id),updated_at timestamptz not null default now(),
 check((role='client' and principal_id is not null) or (role<>'client' and principal_id is null))
);
create table public.business_product_principals(product_id text primary key references products(id),principal_id text not null references business_principals(id));
create table public.business_research(product_id text primary key references products(id),source_url text not null,verified_on date not null,retailer text not null,retail_price_kobo bigint not null check(retail_price_kobo>0),manufacturer text not null,pack_size text not null,unit text not null,notes text not null default '');
create table public.business_van_stock(seller_id uuid references profiles(id),product_id text references products(id),quantity integer not null check(quantity>=0),primary key(seller_id,product_id));
create table public.business_stock_requests(id uuid primary key,actor uuid not null references profiles(id),payload jsonb not null,created_at timestamptz not null default now());
create table public.business_van_movements(id uuid primary key default gen_random_uuid(),seller_id uuid not null references profiles(id),product_id text not null references products(id),quantity integer not null,reason text not null,actor uuid not null references profiles(id),created_at timestamptz not null default now());
create table public.business_van_sales(id uuid primary key,seller_id uuid not null references profiles(id),product_id text not null references products(id),principal_id text references business_principals(id),quantity integer not null check(quantity between 1 and 10000),unit_price_kobo bigint not null check(unit_price_kobo>0),note text not null,created_at timestamptz not null default now(),cash_confirmed_at timestamptz,cash_confirmed_by uuid references profiles(id));
create index business_sales_scope_date on business_van_sales(principal_id,created_at);
alter table order_items add column business_principal_id text references business_principals(id);
create function public.business_snapshot_principal() returns trigger language plpgsql security definer set search_path=public as $$
begin select principal_id into new.business_principal_id from business_product_principals where product_id=new.product_id;return new;end $$;
create trigger business_order_principal before insert on order_items for each row execute function business_snapshot_principal();
revoke all on function business_snapshot_principal() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['business_principals','business_access','business_product_principals','business_research','business_van_stock','business_van_movements','business_van_sales','business_stock_requests'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop;end $$;

-- A confirmed account must claim an owner-approved email; no role comes from metadata.
create function public.business_claim_access() returns void language plpgsql security definer set search_path=public as $$
declare u jsonb;a business_access;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select to_jsonb(x) into u from auth.users x where x.id=auth.uid();
 if u->>'email_confirmed_at' is null then return;end if;
 select * into a from business_access where email=lower(u->>'email') and active for update;
 if not found then return;end if;
 if a.user_id is not null and a.user_id<>auth.uid() then raise exception 'Access belongs to another account';end if;
 if a.user_id is null then
  update business_access set user_id=auth.uid(),prior_role=app_role(),updated_at=now() where email=a.email;
  if a.role='it_manager' then update profiles set role='admin' where id=auth.uid();end if;
  perform audit('business.access.claim',jsonb_build_object('role',a.role));
 end if;
end $$;
create function public.business_role() returns text language sql stable security definer set search_path=public as $$
 select case when app_role()='admin' then 'administrator' when app_role()='operations' then 'warehouse_manager' else
 (select a.role from business_access a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and a.active and lower(to_jsonb(u)->>'email')=a.email and to_jsonb(u)->>'email_confirmed_at' is not null) end
$$;
create function public.business_context() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r text:=business_role();begin
 if r is null then return null;end if;
 return jsonb_build_object('role',r,'principal',(select p.name from business_access a join business_principals p on p.id=a.principal_id where a.user_id=auth.uid() and a.active));
end $$;
create function public.business_set_access(p_email text,p_role text,p_principal text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
declare a business_access;target_id uuid;begin
 if app_role()<>'admin' then raise exception 'Forbidden';end if;
 p_email:=lower(trim(p_email));
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 or p_role not in ('warehouse_manager','it_manager','accounts','client','van_sales') or p_active is null then raise exception 'Invalid access details';end if;
 select id into target_id from auth.users u where lower(to_jsonb(u)->>'email')=p_email;
 if target_id=auth.uid() or exists(select 1 from platform_admins where user_id=target_id) then raise exception 'Owner access is protected';end if;
 select * into a from business_access where email=p_email for update;
 if a.role='it_manager' and a.user_id is not null then
  update profiles set role=coalesce(a.prior_role,'customer') where id=a.user_id;
 end if;
 insert into business_access(email,role,principal_id,active,approved_by) values(p_email,p_role,p_principal,p_active,auth.uid())
 on conflict(email) do update set role=excluded.role,principal_id=excluded.principal_id,active=excluded.active,approved_by=excluded.approved_by,user_id=null,prior_role=null,updated_at=now();
 perform audit('business.access.approve',jsonb_build_object('email',p_email,'role',p_role,'principal',p_principal,'active',p_active));
end $$;
create function public.business_team() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if app_role()<>'admin' then raise exception 'Forbidden';end if;
 return jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('email',a.email,'role',a.role,'principal_id',a.principal_id,'active',a.active,'claimed',a.user_id is not null,'confirmed',exists(select 1 from auth.users u where lower(to_jsonb(u)->>'email')=a.email and to_jsonb(u)->>'email_confirmed_at' is not null)) order by a.email) from business_access a),'[]'::jsonb),'principals',coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from business_principals p),'[]'::jsonb));
end $$;
create function public.business_map_product(p_product text,p_principal text) returns void language plpgsql security definer set search_path=public as $$
begin
 if app_role()<>'admin' then raise exception 'Forbidden';end if;
 if not exists(select 1 from products where id=p_product and merchant_id='edge') then raise exception 'Product unavailable';end if;
 if p_principal is null then delete from business_product_principals where product_id=p_product;
 else insert into business_product_principals values(p_product,p_principal) on conflict(product_id) do update set principal_id=excluded.principal_id;end if;
 perform audit('business.product.principal',jsonb_build_object('product',p_product,'principal',p_principal));
end $$;
create function public.business_adjust_stock(p_id uuid,p_product text,p_delta integer,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare p products;payload jsonb:=jsonb_build_object('action','stock','product',p_product,'quantity',p_delta,'reason',trim(p_reason));prior business_stock_requests;begin
 if business_role() not in ('administrator','warehouse_manager') or business_role() is null then raise exception 'Forbidden';end if;
 if p_delta is null or p_delta=0 or abs(p_delta::bigint)>1000000 or length(trim(p_reason)) not between 10 and 500 then raise exception 'Enter a quantity and a reason of 10 to 500 characters';end if;
 if p_id is null then raise exception 'Movement reference required';end if;
 perform pg_advisory_xact_lock(hashtext(p_id::text));select * into prior from business_stock_requests where id=p_id;
 if found then if prior.actor<>auth.uid() or prior.payload<>payload then raise exception 'Movement reference already used';end if;return;end if;
 select * into p from products where id=p_product and merchant_id='edge' for update;
 if not found then raise exception 'Product unavailable';end if;
 if p.stock::bigint+p_delta<p.reserved or p.stock::bigint+p_delta>2147483647 then raise exception 'Insufficient unreserved stock';end if;
 update products set stock=stock+p_delta where id=p_product;
 insert into stock_movements(product_id,quantity,reason,actor) values(p_product,p_delta,trim(p_reason),auth.uid());
 insert into business_stock_requests values(p_id,auth.uid(),payload,now());
 perform audit('business.stock.adjust',jsonb_build_object('product',p_product,'quantity',p_delta,'reason',trim(p_reason)));
end $$;
create function public.business_allocate_van(p_id uuid,p_seller uuid,p_product text,p_quantity integer,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare p products;held integer;payload jsonb:=jsonb_build_object('action','transfer','seller',p_seller,'product',p_product,'quantity',p_quantity,'reason',trim(p_reason));prior business_stock_requests;begin
 if business_role() not in ('administrator','warehouse_manager') or business_role() is null then raise exception 'Forbidden';end if;
 if p_quantity is null or p_quantity=0 or abs(p_quantity::bigint)>1000000 or length(trim(p_reason)) not between 10 and 500 then raise exception 'Enter quantity and reason';end if;
 if p_id is null then raise exception 'Movement reference required';end if;
 perform pg_advisory_xact_lock(hashtext(p_id::text));select * into prior from business_stock_requests where id=p_id;
 if found then if prior.actor<>auth.uid() or prior.payload<>payload then raise exception 'Movement reference already used';end if;return;end if;
 if not exists(select 1 from business_access where user_id=p_seller and role='van_sales' and active) then raise exception 'Choose an active van salesperson';end if;
 select * into p from products where id=p_product and merchant_id='edge' for update;
 if not found then raise exception 'Product unavailable';end if;
 insert into business_van_stock values(p_seller,p_product,0) on conflict do nothing;
 select quantity into held from business_van_stock where seller_id=p_seller and product_id=p_product for update;
 if p.stock::bigint-p_quantity<p.reserved or held::bigint+p_quantity<0 or held::bigint+p_quantity>2147483647 or p.stock::bigint-p_quantity>2147483647 then raise exception 'Insufficient stock for transfer';end if;
 update products set stock=stock-p_quantity where id=p_product;
 update business_van_stock set quantity=quantity+p_quantity where seller_id=p_seller and product_id=p_product;
 insert into stock_movements(product_id,quantity,reason,actor) values(p_product,-p_quantity,'Van custody: '||trim(p_reason),auth.uid());
 insert into business_van_movements(seller_id,product_id,quantity,reason,actor) values(p_seller,p_product,p_quantity,trim(p_reason),auth.uid());
 insert into business_stock_requests values(p_id,auth.uid(),payload,now());
 perform audit('business.van.transfer',jsonb_build_object('seller',p_seller,'product',p_product,'quantity',p_quantity));
end $$;
create function public.business_record_sale(p_id uuid,p_product text,p_quantity integer,p_note text) returns void language plpgsql security definer set search_path=public as $$
declare p products;prior business_van_sales;principal text;begin
 if business_role() is distinct from 'van_sales' then raise exception 'Forbidden';end if;
 if p_id is null or p_quantity is null or p_quantity not between 1 and 10000 or length(trim(p_note)) not between 3 and 500 then raise exception 'Invalid sale details';end if;
 perform pg_advisory_xact_lock(hashtext(p_id::text));
 select * into prior from business_van_sales where id=p_id;
 if found then
  if prior.seller_id<>auth.uid() or prior.product_id<>p_product or prior.quantity<>p_quantity or prior.note<>trim(p_note) then raise exception 'Sale reference already used';end if;
  return;
 end if;
 select * into p from products where id=p_product and merchant_id='edge' for share;
 if not found or not p.active then raise exception 'Product must be reviewed and active before selling';end if;
 update business_van_stock set quantity=quantity-p_quantity where seller_id=auth.uid() and product_id=p_product and quantity>=p_quantity;
 if not found then raise exception 'Insufficient van stock';end if;
 select principal_id into principal from business_product_principals where product_id=p_product;
 insert into business_van_sales(id,seller_id,product_id,principal_id,quantity,unit_price_kobo,note) values(p_id,auth.uid(),p_product,principal,p_quantity,p.price_kobo,trim(p_note));
 insert into business_van_movements(seller_id,product_id,quantity,reason,actor) values(auth.uid(),p_product,-p_quantity,'Sale '||p_id,auth.uid());
 perform audit('business.van.sale',jsonb_build_object('id',p_id,'product',p_product,'quantity',p_quantity));
end $$;
create function public.business_confirm_cash(p_sale uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if business_role() not in ('administrator','accounts') or business_role() is null then raise exception 'Forbidden';end if;
 update business_van_sales set cash_confirmed_at=now(),cash_confirmed_by=auth.uid() where id=p_sale and cash_confirmed_at is null;
 if found then perform audit('business.van.cash_received',jsonb_build_object('sale',p_sale));
 elsif not exists(select 1 from business_van_sales where id=p_sale) then raise exception 'Sale unavailable';end if;
end $$;

create function public.business_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r text:=business_role();scope text;result jsonb;begin
 if r is null then raise exception 'Forbidden';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'Choose a date range of up to 366 days';end if;
 if r='client' then select principal_id into scope from business_access where user_id=auth.uid() and active;if scope is null then raise exception 'Forbidden';end if;end if;
 result:=jsonb_build_object('role',r,'from',p_from,'to',p_to);
 if r in ('administrator','warehouse_manager','client') then
  result:=result||jsonb_build_object('inventory',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'brand',p.brand,'active',p.active,'stock',p.stock,'reserved',p.reserved,'available',p.available_stock,'van_stock',coalesce((select sum(quantity) from business_van_stock where product_id=p.id),0),'principal_id',b.principal_id,'principal',bp.name,'benchmark_price_kobo',br.retail_price_kobo,'source',br.source_url,'verified_on',br.verified_on) order by p.name) from products p left join business_product_principals b on b.product_id=p.id left join business_principals bp on bp.id=b.principal_id left join business_research br on br.product_id=p.id where p.merchant_id='edge' and (r<>'client' or b.principal_id=scope)),'[]'::jsonb));
 end if;
 if r in ('administrator','warehouse_manager') then
  result:=result||jsonb_build_object('sellers',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'email',email)) from business_access where role='van_sales' and active and user_id is not null),'[]'::jsonb),'movements',coalesce((select jsonb_agg(to_jsonb(m)) from (select sm.id,p.name,sm.quantity,sm.reason,sm.created_at from stock_movements sm join products p on p.id=sm.product_id where p.merchant_id='edge' order by sm.created_at desc limit 100) m),'[]'::jsonb));
 end if;
 if r in ('administrator','accounts') then
  result:=result||jsonb_build_object('finance',jsonb_build_object('verified_payments_kobo',coalesce((select sum(amount_kobo) from payments where verified_at>=(p_from::timestamp at time zone 'Africa/Lagos') and verified_at<((p_to+1)::timestamp at time zone 'Africa/Lagos')),0),'processed_refunds_kobo',coalesce((select sum(amount_kobo) from refunds where status='processed' and created_at>=(p_from::timestamp at time zone 'Africa/Lagos') and created_at<((p_to+1)::timestamp at time zone 'Africa/Lagos')),0),'settlements',coalesce((select jsonb_agg(to_jsonb(s)) from (select id,merchant_id,amount_kobo,reference,status,created_at from settlements where created_at>=(p_from::timestamp at time zone 'Africa/Lagos') and created_at<((p_to+1)::timestamp at time zone 'Africa/Lagos') order by created_at desc) s),'[]'::jsonb)));
 end if;
 if r in ('administrator','accounts','client','van_sales') then
  result:=result||jsonb_build_object('van_sales',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'product',p.name,'seller_id',s.seller_id,'salesperson',coalesce(nullif(pr.name,''),'Salesperson '||left(s.seller_id::text,8)),'quantity',s.quantity,'amount_kobo',s.unit_price_kobo*s.quantity,'created_at',s.created_at,'cash_confirmed_at',s.cash_confirmed_at) order by s.created_at desc) from business_van_sales s join products p on p.id=s.product_id join profiles pr on pr.id=s.seller_id where (r<>'client' or s.principal_id=scope) and (r<>'van_sales' or s.seller_id=auth.uid()) and s.created_at>=(p_from::timestamp at time zone 'Africa/Lagos') and s.created_at<((p_to+1)::timestamp at time zone 'Africa/Lagos')),'[]'::jsonb));
 end if;
 if r in ('administrator','accounts','client') then
  result:=result||jsonb_build_object('online_sales',coalesce((select jsonb_agg(to_jsonb(s)) from (select i.product_id,i.name,sum(i.quantity)::bigint quantity,sum(i.quantity*i.price_kobo)::bigint gross_kobo from order_items i join orders o on o.id=i.order_id where o.payment_status='paid' and i.merchant_id='edge' and (r<>'client' or i.business_principal_id=scope) and o.created_at>=(p_from::timestamp at time zone 'Africa/Lagos') and o.created_at<((p_to+1)::timestamp at time zone 'Africa/Lagos') group by i.product_id,i.name order by i.name) s),'[]'::jsonb));
 end if;
 if r='van_sales' then
  result:=result||jsonb_build_object('van_stock',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'quantity',v.quantity,'price_kobo',p.price_kobo,'active',p.active) order by p.name) from business_van_stock v join products p on p.id=v.product_id where seller_id=auth.uid()),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function business_claim_access(),business_role(),business_context(),business_set_access(text,text,text,boolean),business_team(),business_map_product(text,text),business_adjust_stock(uuid,text,integer,text),business_allocate_van(uuid,uuid,text,integer,text),business_record_sale(uuid,text,integer,text),business_confirm_cash(uuid),business_report(date,date) from public,anon;
grant execute on function business_claim_access(),business_role(),business_context(),business_set_access(text,text,text,boolean),business_team(),business_map_product(text,text),business_adjust_stock(uuid,text,integer,text),business_allocate_van(uuid,uuid,text,integer,text),business_record_sale(uuid,text,integer,text),business_confirm_cash(uuid),business_report(date,date) to authenticated;
