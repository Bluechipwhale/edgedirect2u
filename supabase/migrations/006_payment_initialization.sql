create table public.payment_initializations(reference text primary key references orders(reference),status text not null check(status in ('initializing','ready')),authorization_url text,created_at timestamptz not null default now());
alter table payment_initializations enable row level security;
create policy initialization_staff on payment_initializations for select using(is_staff());
create function public.claim_payment_initialization(p_reference text) returns jsonb language plpgsql security definer set search_path=public as $$ declare o orders;attempt payment_initializations;begin
select * into o from orders where reference=p_reference for update;
if not found or not (o.customer_id=auth.uid() or is_staff()) then raise exception 'Forbidden';end if;
if o.payment_status<>'pending' or o.status<>'awaiting_payment' or o.expires_at<=now() then raise exception 'Order cannot accept a new payment';end if;
select * into attempt from payment_initializations where reference=p_reference;
if found then if attempt.status='ready' then return jsonb_build_object('url',attempt.authorization_url);else raise exception 'Payment initialization awaiting reconciliation. Contact support before starting another checkout';end if;end if;
insert into payment_initializations(reference,status) values(p_reference,'initializing');return jsonb_build_object('claimed',true);end $$;
create function public.save_payment_initialization(p_reference text,p_url text) returns void language plpgsql security definer set search_path=public as $$ begin
if p_url!~'^https://checkout\.paystack\.com/' then raise exception 'Invalid payment URL';end if;
update payment_initializations set status='ready',authorization_url=p_url where reference=p_reference and status='initializing';if not found then raise exception 'Initialization not claimed';end if;end $$;
revoke all on function claim_payment_initialization(text),save_payment_initialization(text,text) from public,anon;
revoke all on function save_payment_initialization(text,text) from authenticated;
grant execute on function claim_payment_initialization(text) to authenticated;
grant execute on function save_payment_initialization(text,text) to service_role;
grant select on payment_initializations to authenticated;
