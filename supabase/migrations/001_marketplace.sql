-- Supabase PostgreSQL: commerce mutations are transactional RPCs; never expose the service key.
create table public.organizations (id text primary key, name text not null, kind text not null check(kind in ('company','merchant')));
insert into public.organizations values ('edge','Edgedirect2u','company');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, role text not null default 'customer' check(role in ('admin','operations','merchant','driver','customer')), merchant_id text references organizations(id), name text not null default '', created_at timestamptz not null default now());
create table public.organization_memberships (organization_id text references organizations(id), user_id uuid references profiles(id), role text not null, primary key(organization_id,user_id));
create function public.app_role() returns text language sql stable security definer set search_path=public as $$ select coalesce((select role from profiles where id=auth.uid()),'customer') $$;
create function public.current_merchant() returns text language sql stable security definer set search_path=public as $$ select merchant_id from profiles where id=auth.uid() $$;
create function public.is_staff() returns boolean language sql stable as $$ select public.app_role() in ('admin','operations') $$;
create function public.handle_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id) values(new.id);return new;end $$;
create trigger edge_new_user after insert on auth.users for each row execute function handle_user();

create table public.merchants (id text primary key references organizations(id), owner_id uuid references profiles(id), name text not null, description text not null default '', email text not null default '', status text not null check(status in ('pending','approved','suspended')), commission_bps integer not null default 1000 check(commission_bps between 0 and 10000), created_at timestamptz not null default now());
insert into merchants(id,name,status,commission_bps) values('edge','Edgedirect2u','approved',0);
create table public.categories (id text primary key, name text not null, image text not null, parent_id text references categories(id), check(parent_id is distinct from id));
create table public.brands(id text primary key,name text not null unique);
create function public.valid_options(p_options jsonb) returns boolean language plpgsql immutable as $$ declare pair record; v jsonb; begin if jsonb_typeof(p_options)<>'object' then return false;end if; for pair in select * from jsonb_each(p_options) loop if jsonb_typeof(pair.value)<>'array' or jsonb_array_length(pair.value)<1 then return false;end if;for v in select value from jsonb_array_elements(pair.value) loop if jsonb_typeof(v)<>'string' then return false;end if;end loop;end loop;return true;end $$;
create table public.products (id text primary key, slug text not null unique check(slug ~ '^[a-z0-9-]+$'), name text not null, category_id text not null references categories(id), brand text not null, merchant_id text not null references merchants(id), merchant_name text not null, price_kobo bigint not null check(price_kobo>0 and price_kobo<=1000000000), previous_price_kobo bigint, stock integer not null default 0 check(stock>=0), reserved integer not null default 0 check(reserved>=0 and reserved<=stock), available_stock integer generated always as(stock-reserved) stored, image text not null, images jsonb not null default '[]', description text not null, options jsonb not null default '{}' check(valid_options(options)), featured boolean not null default false, active boolean not null default true, created_at timestamptz not null default now());
create index products_category_idx on products(category_id,created_at desc);create index products_merchant_idx on products(merchant_id);
create table public.warehouses(id text primary key,name text not null,address text not null,active boolean not null default true,created_at timestamptz not null default now());
create table public.suppliers(id text primary key,name text not null,email text not null,phone text not null default '',address text not null default '',created_at timestamptz not null default now());
create table public.purchase_orders(id text primary key,supplier_id text not null references suppliers(id),warehouse_id text not null references warehouses(id),status text not null check(status in ('draft','ordered','received','cancelled')),notes text not null default '',total_kobo bigint not null check(total_kobo>=0),created_at timestamptz not null default now());
create table public.addresses(id text primary key,owner_id uuid not null references profiles(id),name text not null,phone text not null,street text not null,city text not null,state text not null,created_at timestamptz not null default now());
create table public.coupons(id text primary key,code text not null unique check(code ~ '^[A-Z0-9_-]{2,40}$'),percent integer not null check(percent between 1 and 90),active boolean not null,ends_at timestamptz,created_at timestamptz not null default now());
create table public.orders(id uuid primary key default gen_random_uuid(),customer_id uuid not null references profiles(id),status text not null default 'awaiting_payment' check(status in ('awaiting_payment','expired','processing','ready_for_dispatch','delivered')),payment_status text not null default 'pending' check(payment_status in ('pending','paid','refunded')),address jsonb not null,subtotal_kobo bigint not null,delivery_kobo bigint not null,discount_kobo bigint not null default 0,total_kobo bigint not null check(total_kobo>0),reference text not null unique,expires_at timestamptz not null,created_at timestamptz not null default now(),check(total_kobo=subtotal_kobo+delivery_kobo-discount_kobo));
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references orders(id),product_id text not null references products(id),name text not null,quantity integer not null check(quantity between 1 and 50),price_kobo bigint not null check(price_kobo>0),merchant_id text not null references merchants(id),options jsonb not null default '{}');
create table public.order_allocations(order_id uuid references orders(id),merchant_id text references merchants(id),total_kobo bigint not null,status text not null default 'pending',primary key(order_id,merchant_id));
create table public.stock_movements(id uuid primary key default gen_random_uuid(),product_id text not null references products(id),warehouse_id text references warehouses(id),order_id uuid references orders(id),quantity integer not null,reason text not null,actor uuid references profiles(id),created_at timestamptz not null default now());
create table public.stock_reservations(order_id uuid references orders(id),product_id text references products(id),quantity integer not null check(quantity>0),status text not null check(status in ('active','consumed','released')),primary key(order_id,product_id));
create view public.inventory with(security_invoker=true) as select id as product_id,merchant_id,stock as on_hand,reserved,available_stock from products;
create table public.idempotency_records(key uuid primary key,owner_id uuid not null references profiles(id),fingerprint text not null,order_id uuid not null references orders(id));
create table public.payments(reference text primary key references orders(reference),amount_kobo bigint not null,currency text not null check(currency='NGN'),status text not null check(status='success'),verified_at timestamptz not null default now());
create table public.payment_webhooks(reference text primary key references payments(reference),processed_at timestamptz not null default now());
create table public.refunds(id text primary key,order_id uuid not null references orders(id),amount_kobo bigint not null check(amount_kobo>0),status text not null default 'requested' check(status in ('requested','processing','processed','failed')),provider_reference text,created_at timestamptz not null default now());
create table public.merchant_ledger(id uuid primary key default gen_random_uuid(),order_id uuid references orders(id),merchant_id text references merchants(id),gross_kobo bigint not null,discount_kobo bigint not null,commission_kobo bigint not null,net_kobo bigint not null,status text not null default 'pending_settlement',created_at timestamptz not null default now(),unique(order_id,merchant_id));
create table public.settlements(id text primary key,merchant_id text not null references merchants(id),amount_kobo bigint not null check(amount_kobo>0),reference text not null unique,status text not null check(status in ('pending','recorded')),created_at timestamptz not null default now());
create table public.drivers(id text primary key,user_id uuid not null unique references profiles(id),name text not null,phone text not null,available boolean not null default true,created_at timestamptz not null default now());
create table public.delivery_jobs(id text primary key,order_id uuid not null unique references orders(id),driver_id uuid not null references drivers(user_id),status text not null check(status in ('assigned','picked_up','in_transit','delivered','failed')),created_at timestamptz not null default now());
create table public.delivery_events(id uuid primary key default gen_random_uuid(),delivery_id text not null references delivery_jobs(id),status text not null,note text not null default '',proof text not null default '',actor uuid not null references profiles(id),created_at timestamptz not null default now());
create table public.returns(id text primary key,owner_id uuid not null references profiles(id),order_id uuid not null references orders(id),reason text not null,status text not null check(status in ('requested','approved','declined','received')),created_at timestamptz not null default now());
create table public.reviews(id text primary key,owner_id uuid not null references profiles(id),order_id uuid not null references orders(id),product_id text not null references products(id),rating integer not null check(rating between 1 and 5),comment text not null,status text not null check(status in ('pending','published','rejected')),created_at timestamptz not null default now(),unique(owner_id,product_id,order_id));
create table public.website_settings(id text primary key check(id in ('draft','published')),config jsonb not null,version_id uuid,updated_at timestamptz not null default now());
create table public.theme_versions(id uuid primary key default gen_random_uuid(),config jsonb not null,created_by uuid references profiles(id),created_at timestamptz not null default now());
alter table website_settings add foreign key(version_id) references theme_versions(id);
create table public.branding_assets(id uuid primary key default gen_random_uuid(),path text unique not null,owner_id uuid not null references profiles(id),mime text not null,size_bytes integer not null check(size_bytes<=5242880),created_at timestamptz not null default now());
create table public.website_content(id text primary key,kind text not null check(kind in ('banners','policies','notifications')),data jsonb not null,created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor uuid references profiles(id),action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now());
create function public.audit(p_action text,p_detail jsonb) returns void language sql security definer set search_path=public as $$ insert into audit_logs(actor,action,detail) values(auth.uid(),p_action,p_detail) $$;

-- Self registration never trusts role/organization values from user metadata.
alter table profiles enable row level security;create policy profile_read on profiles for select using(id=auth.uid() or is_staff());
alter table organizations enable row level security;create policy org_read on organizations for select using(is_staff() or id=current_merchant());
alter table organization_memberships enable row level security;create policy memberships_read on organization_memberships for select using(user_id=auth.uid() or app_role()='admin');
alter table merchants enable row level security;create policy merchant_read on merchants for select using(status='approved' or owner_id=auth.uid() or is_staff());
alter table categories enable row level security;create policy categories_read on categories for select using(true);create policy categories_admin on categories for all using(app_role()='admin') with check(app_role()='admin');
alter table brands enable row level security;create policy brands_read on brands for select using(true);
alter table products enable row level security;create policy products_read on products for select using((active and exists(select 1 from merchants where id=merchant_id and status='approved')) or is_staff() or merchant_id=current_merchant());
-- Direct catalogue changes are restricted to the server RPC below; no direct stock updates.
create policy products_admin_insert on products for insert with check(app_role()='admin');
alter table addresses enable row level security;create policy addresses_read on addresses for select using(owner_id=auth.uid() or app_role()='admin');
alter table orders enable row level security;create policy orders_read on orders for select using(customer_id=auth.uid() or is_staff());
alter table order_items enable row level security;create policy items_read on order_items for select using(exists(select 1 from orders where id=order_id and (customer_id=auth.uid() or is_staff())) or merchant_id=current_merchant());
alter table order_allocations enable row level security;create policy allocation_read on order_allocations for select using(is_staff() or merchant_id=current_merchant() or exists(select 1 from orders where id=order_id and customer_id=auth.uid()));
alter table merchant_ledger enable row level security;create policy ledger_read on merchant_ledger for select using(app_role()='admin' or merchant_id=current_merchant());
alter table settlements enable row level security;create policy settlement_read on settlements for select using(app_role()='admin' or merchant_id=current_merchant());
alter table delivery_jobs enable row level security;create policy job_read on delivery_jobs for select using(is_staff() or driver_id=auth.uid());
alter table delivery_events enable row level security;create policy events_read on delivery_events for select using(is_staff() or exists(select 1 from delivery_jobs j where j.id=delivery_id and (j.driver_id=auth.uid() or exists(select 1 from orders o where o.id=j.order_id and o.customer_id=auth.uid()))));
alter table returns enable row level security;create policy returns_read on returns for select using(owner_id=auth.uid() or is_staff());
alter table reviews enable row level security;create policy reviews_read on reviews for select using(status='published' or owner_id=auth.uid() or app_role()='admin');
alter table website_settings enable row level security;create policy settings_read on website_settings for select using(id='published' or app_role()='admin');
alter table theme_versions enable row level security;create policy version_read on theme_versions for select using(app_role()='admin');
alter table website_content enable row level security;create policy content_read on website_content for select using(kind in ('banners','policies') or app_role()='admin');
alter table branding_assets enable row level security;create policy asset_read on branding_assets for select using(app_role()='admin');
do $$ declare t text;begin foreach t in array array['warehouses','suppliers','purchase_orders','coupons','drivers','stock_movements','stock_reservations','payments','payment_webhooks','refunds','audit_logs','idempotency_records'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy staff_read on public.%I for select using(public.is_staff())',t);end loop;end $$;

-- A common read facade, backed by separate relational tables and their RLS policies.
create view public.operational_records with(security_invoker=true) as
select id,'merchants'::text kind,owner_id,id merchant_id,jsonb_build_object('name',name,'description',description,'status',status,'commission_bps',commission_bps) data,created_at from merchants
union all select id,'warehouses',null::uuid,null::text,to_jsonb(w)-'id'-'created_at',created_at from warehouses w
union all select id,'suppliers',null::uuid,null::text,to_jsonb(s)-'id'-'created_at',created_at from suppliers s
union all select id,'purchase_orders',null::uuid,null::text,to_jsonb(p)-'id'-'created_at',created_at from purchase_orders p
union all select id,'addresses',owner_id,null::text,to_jsonb(a)-'id'-'created_at',created_at from addresses a
union all select id,'coupons',null::uuid,null::text,to_jsonb(c)-'id'-'created_at',created_at from coupons c
union all select id,'drivers',user_id,null::text,to_jsonb(d)-'id'-'created_at',created_at from drivers d
union all select id,'deliveries',driver_id,null::text,to_jsonb(j)-'id'-'created_at',created_at from delivery_jobs j
union all select id::text,'delivery_events',actor,null::text,to_jsonb(e)-'id'-'created_at',created_at from delivery_events e
union all select id::text,'stock_movements',actor,null::text,to_jsonb(m)-'id'-'created_at',created_at from stock_movements m
union all select id::text,'merchant_ledger',null::uuid,merchant_id,to_jsonb(l)-'id'-'created_at',created_at from merchant_ledger l
union all select id,'settlements',null::uuid,merchant_id,to_jsonb(s)-'id'-'created_at',created_at from settlements s
union all select id,'refunds',null::uuid,null::text,to_jsonb(r)-'id'-'created_at',created_at from refunds r
union all select id,'returns',owner_id,null::text,to_jsonb(r)-'id'-'created_at',created_at from returns r
union all select id,'reviews',owner_id,null::text,to_jsonb(r)-'id'-'created_at',created_at from reviews r
union all select id,kind,null::uuid,null::text,data,created_at from website_content
union all select id::text,'audit',actor,null::text,jsonb_build_object('actor',actor,'action',action,'detail',detail),created_at from audit_logs
union all select id::text,'customers',id,null::text,jsonb_build_object('name',name,'role',role),created_at from profiles where role='customer';

create function public.order_json(p_order uuid,p_merchant text default null) returns jsonb language sql stable security definer set search_path=public as $$
select to_jsonb(o)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)-'id'-'order_id') from order_items i where i.order_id=o.id and (p_merchant is null or i.merchant_id=p_merchant)),'[]'::jsonb),'allocations',coalesce((select jsonb_agg(to_jsonb(a)-'order_id') from order_allocations a where a.order_id=o.id and (p_merchant is null or a.merchant_id=p_merchant)),'[]'::jsonb)) from orders o where o.id=p_order $$;
create function public.my_orders() returns jsonb language plpgsql stable security definer set search_path=public as $$ declare result jsonb;begin
if auth.uid() is null then raise exception 'Authentication required';end if;
if app_role()='merchant' then select coalesce(jsonb_agg((order_json(o.id,current_merchant())-'address'-'customer_id'-'subtotal_kobo'-'delivery_kobo'-'discount_kobo'-'total_kobo'-'reference')||jsonb_build_object('address','{}'::jsonb,'total_kobo',a.total_kobo) order by o.created_at desc),'[]') into result from orders o join order_allocations a on a.order_id=o.id and a.merchant_id=current_merchant();
else select coalesce(jsonb_agg(order_json(id) order by created_at desc),'[]') into result from (select * from orders where is_staff() or customer_id=auth.uid() order by created_at desc limit 100) o;end if;return result;end $$;

create function public.expire_reservations() returns integer language plpgsql security definer set search_path=public as $$ declare o orders; r stock_reservations;count integer:=0;begin
for o in select * from orders where status='awaiting_payment' and expires_at<=now() order by id for update loop
for r in select * from stock_reservations where order_id=o.id and status='active' order by product_id loop update products set reserved=reserved-r.quantity where id=r.product_id;insert into stock_movements(product_id,order_id,quantity,reason) values(r.product_id,o.id,r.quantity,'Reservation expired');end loop;
update stock_reservations set status='released' where order_id=o.id;update orders set status='expired' where id=o.id;count:=count+1;end loop;return count;end $$;
create function public.create_checkout(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare k uuid:=(p_input->>'key')::uuid;fp text:=md5((p_input-'key')::text);prior idempotency_records;i jsonb;p products;pair record;opt record;qty integer;subtotal bigint:=0;shipping bigint;discount bigint:=0;discount_percent integer;oid uuid:=gen_random_uuid();ref text:='edge-'||gen_random_uuid()::text;begin
if auth.uid() is null then raise exception 'Authentication required';end if;
if jsonb_typeof(p_input->'items')<>'array' or jsonb_array_length(p_input->'items') not between 1 and 50 then raise exception 'Invalid cart';end if;
if length(p_input->'address'->>'name')<2 or length(p_input->'address'->>'street')<5 or coalesce(p_input->'address'->>'email','')!~'^[^@ ]+@[^@ ]+\.[^@ ]+$' then raise exception 'Invalid delivery address';end if;
perform pg_advisory_xact_lock(hashtextextended(k::text,0));
select * into prior from idempotency_records where key=k;if found then if prior.owner_id<>auth.uid() or prior.fingerprint<>fp then raise exception 'Idempotency key already used for a different checkout';end if;return order_json(prior.order_id);end if;
perform expire_reservations();
-- Lock all distinct products in a stable order before calculating any totals.
for pair in select value->>'product_id' id,sum((value->>'quantity')::integer)::integer qty from jsonb_array_elements(p_input->'items') group by 1 order by 1 loop
select * into p from products where id=pair.id for update;
if not found or not p.active or not exists(select 1 from merchants where id=p.merchant_id and status='approved') then raise exception 'Product no longer available';end if;
if pair.qty<1 or p.stock-p.reserved<pair.qty then raise exception 'Insufficient stock: %',p.name;end if;
end loop;
for i in select value from jsonb_array_elements(p_input->'items') loop
select * into p from products where id=i->>'product_id';qty:=(i->>'quantity')::integer;if qty not between 1 and 50 then raise exception 'Invalid quantity';end if;
if jsonb_typeof(coalesce(i->'options','{}'))<>'object' then raise exception 'Invalid product options';end if;
for opt in select * from jsonb_each(p.options) loop if not opt.value ? coalesce(i->'options'->>opt.key,'') then raise exception 'Select a valid %',opt.key;end if;end loop;
for opt in select * from jsonb_each(coalesce(i->'options','{}')) loop if not p.options ? opt.key then raise exception 'Invalid product option';end if;end loop;
subtotal:=subtotal+p.price_kobo*qty;end loop;
if coalesce(p_input->>'coupon','')<>'' then select percent into discount_percent from coupons where code=upper(p_input->>'coupon') and active and (ends_at is null or ends_at>now());if not found then raise exception 'Coupon invalid or expired';end if;discount:=subtotal*discount_percent/100;end if;
shipping:=case p_input->'address'->>'state' when 'Lagos' then 250000 when 'Ogun' then 350000 when 'Oyo' then 350000 else 500000 end;
insert into orders(id,customer_id,address,subtotal_kobo,delivery_kobo,discount_kobo,total_kobo,reference,expires_at) values(oid,auth.uid(),p_input->'address',subtotal,shipping,discount,subtotal+shipping-discount,ref,now()+interval '30 minutes');
for i in select value from jsonb_array_elements(p_input->'items') loop select * into p from products where id=i->>'product_id';insert into order_items(order_id,product_id,name,quantity,price_kobo,merchant_id,options) values(oid,p.id,p.name,(i->>'quantity')::integer,p.price_kobo,p.merchant_id,coalesce(i->'options','{}'));end loop;
insert into order_allocations(order_id,merchant_id,total_kobo) select oid,merchant_id,sum(quantity*price_kobo) from order_items where order_id=oid group by merchant_id;
insert into stock_reservations(order_id,product_id,quantity,status) select oid,product_id,sum(quantity),'active' from order_items where order_id=oid group by product_id;
update products prd set reserved=prd.reserved+sr.quantity from stock_reservations sr where sr.order_id=oid and sr.product_id=prd.id;
insert into stock_movements(product_id,order_id,quantity,reason,actor) select product_id,oid,-quantity,'Reserved at checkout',auth.uid() from stock_reservations where order_id=oid;
insert into idempotency_records values(k,auth.uid(),fp,oid);perform audit('order.created',jsonb_build_object('id',oid));return order_json(oid);end $$;

create function public.apply_payment(p_reference text,p_amount bigint,p_currency text,p_status text) returns jsonb language plpgsql security definer set search_path=public as $$ declare o orders;r stock_reservations;a order_allocations;allocated_discount bigint;commission bigint;bps integer;begin
select * into o from orders where reference=p_reference for update;if not found then raise exception 'Unknown payment reference';end if;
if p_status<>'success' or p_amount<>o.total_kobo or p_currency<>'NGN' then raise exception 'Payment verification mismatch';end if;
if exists(select 1 from payments where reference=p_reference) then return order_json(o.id);end if;
if o.status<>'awaiting_payment' or o.expires_at<=now() then raise exception 'Reservation expired; payment requires reconciliation';end if;
for r in select * from stock_reservations where order_id=o.id and status='active' order by product_id loop update products set stock=stock-r.quantity,reserved=reserved-r.quantity where id=r.product_id;insert into stock_movements(product_id,order_id,quantity,reason) values(r.product_id,o.id,-r.quantity,'Paid sale');end loop;
update stock_reservations set status='consumed' where order_id=o.id;update orders set payment_status='paid',status='processing' where id=o.id;update order_allocations set status='processing' where order_id=o.id;
insert into payments values(p_reference,p_amount,p_currency,p_status,now());insert into payment_webhooks(reference) values(p_reference);
for a in select * from order_allocations where order_id=o.id loop select commission_bps into bps from merchants where id=a.merchant_id;allocated_discount:=floor(o.discount_kobo::numeric*a.total_kobo/o.subtotal_kobo);commission:=(a.total_kobo-allocated_discount)*bps/10000;insert into merchant_ledger(order_id,merchant_id,gross_kobo,discount_kobo,commission_kobo,net_kobo) values(o.id,a.merchant_id,a.total_kobo,allocated_discount,commission,a.total_kobo-allocated_discount-commission);end loop;
perform audit('payment.verified',jsonb_build_object('reference',p_reference));return order_json(o.id);end $$;
create function public.adjust_stock(p_product text,p_quantity integer,p_reason text) returns void language plpgsql security definer set search_path=public as $$ declare p products;begin
select * into p from products where id=p_product for update;if not found or not(is_staff() or (app_role()='merchant' and p.merchant_id=current_merchant())) then raise exception 'Forbidden';end if;
if length(trim(p_reason))<3 or p.stock+p_quantity<p.reserved then raise exception 'Invalid adjustment or stock is reserved';end if;update products set stock=stock+p_quantity where id=p_product;insert into stock_movements(product_id,quantity,reason,actor) values(p_product,p_quantity,p_reason,auth.uid());perform audit('stock.adjusted',jsonb_build_object('id',p_product,'quantity',p_quantity,'reason',p_reason));end $$;

create function public.ready_order(p_order uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not is_staff() then raise exception 'Forbidden';end if;update orders set status='ready_for_dispatch' where id=p_order and payment_status='paid' and status='processing';if not found then raise exception 'Invalid order transition';end if;perform audit('order.ready',jsonb_build_object('id',p_order));end $$;
create function public.assign_delivery(p_order uuid,p_driver uuid) returns void language plpgsql security definer set search_path=public as $$ declare o orders;jid text:=gen_random_uuid()::text;begin
if not is_staff() then raise exception 'Forbidden';end if;select * into o from orders where id=p_order for update;if not found or o.payment_status<>'paid' or o.status<>'ready_for_dispatch' then raise exception 'Only paid ready orders may be assigned';end if;if not exists(select 1 from drivers d join profiles p on p.id=d.user_id where d.user_id=p_driver and d.available and p.role='driver') then raise exception 'Select an available driver';end if;
insert into delivery_jobs(id,order_id,driver_id,status) values(jid,p_order,p_driver,'assigned');insert into delivery_events(delivery_id,status,actor) values(jid,'assigned',auth.uid());perform audit('delivery.assigned',jsonb_build_object('id',jid));end $$;
create function public.update_delivery(p_id text,p_status text,p_note text,p_proof text) returns void language plpgsql security definer set search_path=public as $$ declare j delivery_jobs;begin select * into j from delivery_jobs where id=p_id for update;
if not found or not(is_staff() or(app_role()='driver' and j.driver_id=auth.uid())) then raise exception 'Forbidden';end if;
if not ((j.status='assigned' and p_status in ('picked_up','failed')) or(j.status='picked_up' and p_status in ('in_transit','failed')) or(j.status='in_transit' and p_status in ('delivered','failed')) or(j.status='failed' and p_status='assigned')) then raise exception 'Invalid delivery transition';end if;
if p_status='delivered' and length(trim(p_proof))<1 then raise exception 'Recipient confirmation required';end if;if p_status='failed' and length(trim(p_note))<1 then raise exception 'Failure reason required';end if;
update delivery_jobs set status=p_status where id=p_id;insert into delivery_events(delivery_id,status,note,proof,actor) values(p_id,p_status,p_note,p_proof,auth.uid());if p_status='delivered' then update orders set status='delivered' where id=j.order_id;end if;perform audit('delivery.updated',jsonb_build_object('id',p_id,'status',p_status));end $$;
create function public.request_refund(p_order uuid,p_amount bigint) returns text language plpgsql security definer set search_path=public as $$ declare o orders;rid text:=gen_random_uuid()::text;begin if app_role()<>'admin' then raise exception 'Forbidden';end if;select * into o from orders where id=p_order for update;if not found or o.payment_status<>'paid' or p_amount<=0 then raise exception 'Invalid refund';end if;if p_amount+coalesce((select sum(amount_kobo) from refunds where order_id=p_order and status<>'failed'),0)>o.total_kobo then raise exception 'Refund exceeds paid amount';end if;insert into refunds(id,order_id,amount_kobo) values(rid,p_order,p_amount);perform audit('refund.requested',jsonb_build_object('id',rid));return rid;end $$;

-- Internal helpers are never callable by browser clients, including authenticated clients.
revoke all on function order_json(uuid,text),audit(text,jsonb),handle_user(),expire_reservations(),apply_payment(text,bigint,text,text) from public,anon,authenticated;
grant execute on function expire_reservations(),apply_payment(text,bigint,text,text) to service_role;
grant usage on schema public to anon,authenticated;
grant select on all tables in schema public to anon,authenticated;
grant insert,update on categories to authenticated;
grant execute on function create_checkout(jsonb),my_orders(),adjust_stock(text,integer,text),ready_order(uuid),assign_delivery(uuid,uuid),update_delivery(text,text,text,text),request_refund(uuid,bigint) to authenticated;
revoke execute on function create_checkout(jsonb),my_orders(),adjust_stock(text,integer,text),ready_order(uuid),assign_delivery(uuid,uuid),update_delivery(text,text,text,text),request_refund(uuid,bigint) from public,anon;


