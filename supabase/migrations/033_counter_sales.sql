-- A separate counter-sales subledger: no fake customer accounts or processor receipts.
create table public.pos_sales(
 id uuid primary key,created_by uuid not null references profiles(id),buyer jsonb not null,method text not null check(method in ('cash','bank_transfer','paystack')),
 status text not null default 'reserved' check(status in ('reserved','paid','cancelled','expired','refunded')),total_kobo bigint not null check(total_kobo>0),
 reference text not null unique,fingerprint text not null,expires_at timestamptz not null default now()+interval '30 minutes',created_at timestamptz not null default now(),
 initialization text check(initialization in ('initializing','ready')),authorization_url text
);
create table public.pos_items(id uuid primary key default gen_random_uuid(),sale_id uuid not null references pos_sales(id),product_id text not null references products(id),name text not null,quantity integer not null check(quantity between 1 and 50),price_kobo bigint not null check(price_kobo>0),options jsonb not null);
create table public.pos_reservations(sale_id uuid references pos_sales(id),product_id text references products(id),quantity integer not null check(quantity>0),status text not null check(status in ('active','consumed','released')),primary key(sale_id,product_id));
create table public.pos_receipts(sale_id uuid primary key references pos_sales(id),method text not null,amount_kobo bigint not null check(amount_kobo>0),tender_kobo bigint not null,external_reference text not null,confirmed_by uuid references profiles(id),confirmed_at timestamptz not null default now(),note text not null);
create unique index pos_receipt_reference_idx on pos_receipts(lower(external_reference));
create table public.pos_refunds(id uuid primary key,sale_id uuid not null references pos_sales(id),amount_kobo bigint not null check(amount_kobo>0),external_reference text not null,note text not null,confirmed_by uuid references profiles(id),confirmed_at timestamptz not null default now());
create unique index pos_refund_reference_idx on pos_refunds(lower(external_reference));
alter table stock_movements add column pos_sale_id uuid references pos_sales(id);
do $$declare t text;begin foreach t in array array['pos_sales','pos_items','pos_reservations','pos_receipts','pos_refunds'] loop
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public,anon,authenticated',t);
 execute format('grant select on %I to authenticated',t);
 execute format('create policy pos_staff_read on %I for select using(auth.uid() is not null and is_staff())',t);
end loop;end $$;
create function public.pos_sale_json(p_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select to_jsonb(s)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from pos_items i where sale_id=s.id),'[]'),
 'receipt',(select to_jsonb(r) from pos_receipts r where sale_id=s.id),'refunds',coalesce((select jsonb_agg(to_jsonb(r) order by confirmed_at,id) from pos_refunds r where sale_id=s.id),'[]')) from pos_sales s where id=p_id
$$;
create function public.release_pos_sale(p_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
declare s pos_sales;r pos_reservations;begin
 select * into s from pos_sales where id=p_id for update;
 if s.status<>'reserved' then return;end if;
 if p_status not in ('expired','cancelled') then raise exception 'Invalid release';end if;
 for r in select * from pos_reservations where sale_id=p_id and status='active' order by product_id loop
  update products set reserved=reserved-r.quantity where id=r.product_id;
  insert into stock_movements(product_id,pos_sale_id,quantity,reason,actor) values(r.product_id,p_id,r.quantity,'POS reservation '||p_status,auth.uid());
 end loop;
 update pos_reservations set status='released' where sale_id=p_id and status='active';update pos_sales set status=p_status where id=p_id;
 perform audit('pos.'||p_status,jsonb_build_object('sale',p_id));
end $$;
create function public.expire_pos_sales() returns integer language plpgsql security definer set search_path=public as $$
declare s pos_sales;n integer:=0;begin
 for s in select * from pos_sales where status='reserved' and expires_at<=now() order by id for update loop perform release_pos_sale(s.id,'expired');n:=n+1;end loop;return n;
end $$;
-- Keep the existing cron entry point and web expiry behavior.
alter function public.expire_reservations() rename to expire_web_reservations;
create function public.expire_reservations() returns integer language plpgsql security definer set search_path=public as $$
declare n integer;begin n:=expire_web_reservations();return n+expire_pos_sales();end $$;
create function public.reserve_counter_sale(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid:=(p_input->>'id')::uuid;fp text:=md5(p_input::text);prior pos_sales;r record;i jsonb;p products;opt record;total bigint:=0;begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;
 if sid is null or p_input->>'method' is null or p_input->>'method' not in ('cash','bank_transfer','paystack') or jsonb_typeof(p_input->'items') is distinct from 'array' or jsonb_array_length(p_input->'items') not between 1 and 50 or jsonb_typeof(p_input->'buyer') is distinct from 'object' or length(coalesce(p_input#>>'{buyer,name}','')) not between 2 and 100 or length(coalesce(p_input#>>'{buyer,phone}',''))>40 or length(coalesce(p_input#>>'{buyer,email}',''))>254 then raise exception 'Invalid counter sale';end if;
 if p_input->>'method'='paystack' and coalesce(p_input#>>'{buyer,email}','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Paystack requires the buyer email';end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
 select * into prior from pos_sales where id=sid;
 if found then if prior.created_by<>auth.uid() or prior.fingerprint<>fp then raise exception 'Sale ID already used for different details';end if;return pos_sale_json(sid);end if;
 perform expire_reservations();
 for i in select value from jsonb_array_elements(p_input->'items') loop
  if coalesce(i->>'quantity','') !~ '^[0-9]{1,2}$' or (i->>'quantity')::integer not between 1 and 50 or length(coalesce(i->>'product_id','')) not between 1 and 100 or jsonb_typeof(coalesce(i->'options','{}')) is distinct from 'object' then raise exception 'Invalid item quantity or options';end if;
 end loop;
 for r in select value->>'product_id' product_id,sum((value->>'quantity')::integer)::integer quantity from jsonb_array_elements(p_input->'items') group by 1 order by 1 loop
  select * into p from products where id=r.product_id for update;
  if not found or not p.active or p.archived_at is not null or p.merchant_id<>'edge' or not approved_merchant(p.merchant_id) then raise exception 'Only published in-house products can be sold at this counter';end if;
  if p.available_stock<r.quantity then raise exception 'Insufficient stock: %',p.name;end if;
 end loop;
 for i in select value from jsonb_array_elements(p_input->'items') loop
  select * into p from products where id=i->>'product_id';
  for opt in select * from jsonb_each(p.options) loop if not opt.value ? coalesce(i->'options'->>opt.key,'') then raise exception 'Select a valid %',opt.key;end if;end loop;
  for opt in select * from jsonb_each(coalesce(i->'options','{}')) loop if not p.options ? opt.key then raise exception 'Invalid product option';end if;end loop;
  total:=total+p.price_kobo*(i->>'quantity')::integer;
 end loop;
 if total>100000000000 then raise exception 'Counter sale exceeds the supported receipt limit';end if;
 insert into pos_sales(id,created_by,buyer,method,total_kobo,reference,fingerprint) values(sid,auth.uid(),jsonb_build_object('name',p_input#>>'{buyer,name}','email',coalesce(p_input#>>'{buyer,email}',''),'phone',coalesce(p_input#>>'{buyer,phone}','')),p_input->>'method',total,'edge-pos-'||sid,fp);
 for i in select value from jsonb_array_elements(p_input->'items') loop
  select * into p from products where id=i->>'product_id';insert into pos_items(sale_id,product_id,name,quantity,price_kobo,options) values(sid,p.id,p.name,(i->>'quantity')::integer,p.price_kobo,coalesce(i->'options','{}'));
 end loop;
 insert into pos_reservations select sid,product_id,sum(quantity),'active' from pos_items where sale_id=sid group by product_id;
 update products prd set reserved=prd.reserved+reserved_row.quantity from pos_reservations reserved_row where reserved_row.sale_id=sid and prd.id=reserved_row.product_id;
 insert into stock_movements(product_id,pos_sale_id,quantity,reason,actor) select product_id,sid,-quantity,'POS stock reserved',auth.uid() from pos_reservations where sale_id=sid;
 perform audit('pos.reserved',jsonb_build_object('sale',sid,'method',p_input->>'method','total_kobo',total));return pos_sale_json(sid);
end $$;
-- Internal payment posting; only validated manual/processor entry points call it.
create function public.post_pos_receipt(p_id uuid,p_method text,p_amount bigint,p_tender bigint,p_reference text,p_note text,p_actor uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pos_sales;r pos_reservations;begin
 select * into s from pos_sales where id=p_id for update;if not found or s.method is distinct from p_method or s.total_kobo is distinct from p_amount then raise exception 'Payment amount or method mismatch';end if;
 if exists(select 1 from pos_receipts where sale_id=p_id) then return pos_sale_json(p_id);end if;
 if s.status<>'reserved' or s.expires_at<=now() then raise exception 'Reservation expired or cancelled. Payment requires reconciliation before releasing goods.';end if;
 if p_reference is null or length(trim(p_reference)) not between 6 and 160 or p_note is null or length(trim(p_note)) not between 3 and 500 or p_tender is null or p_tender<p_amount then raise exception 'Record the payment reference, amount and confirmation';end if;
 if p_method<>'cash' and p_tender<>p_amount then raise exception 'Payment amount mismatch';end if;
 if not exists(select 1 from pos_reservations where sale_id=p_id and status='active') or exists(select 1 from pos_reservations where sale_id=p_id and status<>'active') then raise exception 'Stock reservation requires reconciliation';end if;
 insert into pos_receipts(sale_id,method,amount_kobo,tender_kobo,external_reference,confirmed_by,note) values(p_id,p_method,p_amount,p_tender,trim(p_reference),p_actor,trim(p_note));
 for r in select * from pos_reservations where sale_id=p_id and status='active' order by product_id loop
  update products set stock=stock-r.quantity,reserved=reserved-r.quantity where id=r.product_id;
  insert into stock_movements(product_id,pos_sale_id,quantity,reason,actor) values(r.product_id,p_id,-r.quantity,'POS paid sale',p_actor);
 end loop;
 update pos_reservations set status='consumed' where sale_id=p_id and status='active';update pos_sales set status='paid' where id=p_id;
 perform audit('pos.payment_confirmed',jsonb_build_object('sale',p_id,'method',p_method,'amount_kobo',p_amount,'confirmed_by',p_actor));return pos_sale_json(p_id);
end $$;
create function public.confirm_counter_payment(p_id uuid,p_amount bigint,p_tender bigint,p_reference text,p_note text,p_checked boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pos_sales;begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;select * into s from pos_sales where id=p_id;
 if s.method not in ('cash','bank_transfer') or s.id is null then raise exception 'Use provider verification for online payments';end if;
 if s.method='bank_transfer' and app_role() is distinct from 'admin' then raise exception 'Administrator must verify the bank receipt';end if;
 if s.method='bank_transfer' and length(trim(coalesce(p_reference,''))) not between 6 and 150 then raise exception 'Enter the actual bank reference';end if;
 if p_checked is distinct from true then raise exception 'Confirm that payment has actually been received';end if;
 return post_pos_receipt(p_id,s.method,p_amount,p_tender,case when s.method='cash' then 'cash-'||p_id else 'bank-'||lower(trim(p_reference)) end,p_note,auth.uid());
end $$;
create function public.apply_pos_payment(p_reference text,p_amount bigint,p_currency text,p_status text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pos_sales;begin
 if p_currency is distinct from 'NGN' or p_status is distinct from 'success' then raise exception 'Payment verification mismatch';end if;
 select * into s from pos_sales where reference=p_reference;if not found or s.method<>'paystack' then raise exception 'Unknown POS payment reference';end if;
 return post_pos_receipt(s.id,'paystack',p_amount,p_amount,p_reference,'Paystack charge independently verified',null);
end $$;
create function public.cancel_counter_sale(p_id uuid) returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;
 if exists(select 1 from pos_sales where id=p_id and status='paid') then raise exception 'Paid sales require a refund';end if;
 perform release_pos_sale(p_id,'cancelled');
end $$;
create function public.claim_pos_initialization(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s pos_sales;begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;
 select * into s from pos_sales where id=p_id for update;
 if not found or s.method<>'paystack' or s.status<>'reserved' or s.expires_at<=now() then raise exception 'Sale cannot accept a new payment';end if;
 if s.initialization='ready' then return jsonb_build_object('url',s.authorization_url);end if;
 if s.initialization='initializing' then raise exception 'Initialization needs reconciliation. Do not start another payment.';end if;
 update pos_sales set initialization='initializing' where id=p_id;return pos_sale_json(p_id);
end $$;
create function public.save_pos_initialization(p_id uuid,p_url text) returns void language plpgsql security definer set search_path=public as $$begin
 if p_url is null or p_url!~'^https://checkout\.paystack\.com/' then raise exception 'Invalid payment URL';end if;
 update pos_sales set initialization='ready',authorization_url=p_url where id=p_id and initialization='initializing';if not found then raise exception 'Initialization not claimed';end if;
end $$;
create function public.record_counter_refund(p_id uuid,p_sale uuid,p_amount bigint,p_reference text,p_note text) returns void language plpgsql security definer set search_path=public as $$
declare s pos_sales;prior pos_refunds;begin
 if auth.uid() is null or app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 select * into s from pos_sales where id=p_sale for update;
 if s.method='paystack' then raise exception 'Paystack refunds require independent provider reconciliation';end if;
 if p_id is null or p_amount is null or p_amount<=0 or p_reference is null or length(trim(p_reference)) not between 6 and 160 or p_note is null or length(trim(p_note)) not between 10 and 500 then raise exception 'Record the completed external refund reference and reason';end if;
 select * into prior from pos_refunds where id=p_id;if found then if prior.sale_id=p_sale and prior.amount_kobo=p_amount and prior.external_reference=trim(p_reference) then return;end if;raise exception 'Refund ID already used';end if;
 if s.status<>'paid' or p_amount+coalesce((select sum(amount_kobo) from pos_refunds where sale_id=p_sale),0)>s.total_kobo then raise exception 'Refund exceeds paid balance';end if;
 insert into pos_refunds(id,sale_id,amount_kobo,external_reference,note,confirmed_by) values(p_id,p_sale,p_amount,trim(p_reference),trim(p_note),auth.uid());
 if (select sum(amount_kobo) from pos_refunds where sale_id=p_sale)=s.total_kobo then update pos_sales set status='refunded' where id=p_sale;end if;
 perform audit('pos.external_refund_recorded',jsonb_build_object('sale',p_sale,'refund',p_id,'amount_kobo',p_amount));
end $$;
create function public.reconcile_counter_refund(p_id uuid,p_sale uuid,p_amount bigint,p_provider text,p_actor uuid) returns void language plpgsql security definer set search_path=public as $$
declare s pos_sales;prior pos_refunds;begin
 if not exists(select 1 from profiles where id=p_actor and role='admin') then raise exception 'Forbidden';end if;
 select * into s from pos_sales where id=p_sale for update;
 if s.method is distinct from 'paystack' or p_provider is null or p_provider !~ '^[0-9]+$' or p_id is null or p_amount is null or p_amount<=0 then raise exception 'Invalid provider refund';end if;
 select * into prior from pos_refunds where external_reference='paystack-refund-'||p_provider;
 if found then if prior.sale_id=p_sale and prior.amount_kobo=p_amount then return;end if;raise exception 'Provider refund already recorded';end if;
 if s.status<>'paid' or p_amount+coalesce((select sum(amount_kobo) from pos_refunds where sale_id=p_sale),0)>s.total_kobo then raise exception 'Refund exceeds paid balance';end if;
 insert into pos_refunds(id,sale_id,amount_kobo,external_reference,note,confirmed_by) values(p_id,p_sale,p_amount,'paystack-refund-'||p_provider,'Processed Paystack refund independently verified',p_actor);
 if (select sum(amount_kobo) from pos_refunds where sale_id=p_sale)=s.total_kobo then update pos_sales set status='refunded' where id=p_sale;end if;
 perform audit('pos.provider_refund_reconciled',jsonb_build_object('sale',p_sale,'refund',p_id,'amount_kobo',p_amount,'confirmed_by',p_actor));
end $$;
create function public.counter_reporting(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare start_at timestamptz:=p_from::timestamp at time zone 'Africa/Lagos';end_at timestamptz:=(p_to+1)::timestamp at time zone 'Africa/Lagos';result jsonb;begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a period of up to 366 days';end if;
 select jsonb_build_object('methods',coalesce((select jsonb_agg(to_jsonb(x) order by x.method) from(select method,count(*) receipts,sum(amount_kobo) received_kobo,sum(tender_kobo-amount_kobo) change_kobo from pos_receipts where confirmed_at>=start_at and confirmed_at<end_at group by method) x),'[]'),
 'refunds_kobo',coalesce((select sum(amount_kobo) from pos_refunds where confirmed_at>=start_at and confirmed_at<end_at),0),
 'sales',coalesce((select jsonb_agg(to_jsonb(x) order by x.status) from(select status,count(*) count from pos_sales where created_at>=start_at and created_at<end_at group by status) x),'[]')) into result;return result;
end $$;
revoke all on function counter_reporting(date,date) from public,anon;
grant execute on function counter_reporting(date,date) to authenticated;
revoke all on function reconcile_counter_refund(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function reconcile_counter_refund(uuid,uuid,bigint,text,uuid) to service_role;
revoke all on function pos_sale_json(uuid),release_pos_sale(uuid,text),expire_pos_sales(),expire_web_reservations(),expire_reservations(),post_pos_receipt(uuid,text,bigint,bigint,text,text,uuid),apply_pos_payment(text,bigint,text,text),save_pos_initialization(uuid,text) from public,anon,authenticated;
grant execute on function expire_reservations(),apply_pos_payment(text,bigint,text,text),save_pos_initialization(uuid,text) to service_role;
revoke all on function reserve_counter_sale(jsonb),confirm_counter_payment(uuid,bigint,bigint,text,text,boolean),cancel_counter_sale(uuid),claim_pos_initialization(uuid),record_counter_refund(uuid,uuid,bigint,text,text) from public,anon;
grant execute on function reserve_counter_sale(jsonb),confirm_counter_payment(uuid,bigint,bigint,text,text,boolean),cancel_counter_sale(uuid),claim_pos_initialization(uuid),record_counter_refund(uuid,uuid,bigint,text,text) to authenticated;
