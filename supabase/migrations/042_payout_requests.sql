create function public.valid_payout_payee(p jsonb) returns boolean language plpgsql immutable as $$begin
 if jsonb_typeof(p) is distinct from 'object' then return false;end if;
 return coalesce((select count(*)=3 from jsonb_object_keys(p)) and jsonb_typeof(p->'bank_name')='string' and jsonb_typeof(p->'account_name')='string' and jsonb_typeof(p->'account_number')='string' and length(p->>'bank_name') between 2 and 100 and length(p->>'account_name') between 2 and 100 and p->>'account_number' ~ '^[0-9]{10}$',false);
end $$;
create table public.payout_requests(id uuid primary key,kind text not null check(kind in ('merchant','staff')),owner_id uuid not null references profiles(id),merchant_id text references merchants(id),company_id uuid references platform_companies(id),amount_kobo bigint not null check(amount_kobo between 1 and 100000000000),payee jsonb not null check(valid_payout_payee(payee)),note text not null check(length(note) between 10 and 500),status text not null default 'requested' check(status in ('requested','approved','rejected','cancelled','paid')),review_note text not null default '',reviewed_by uuid references profiles(id),payment_reference text,paid_at timestamptz,paid_by uuid references profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((kind='merchant' and merchant_id is not null and company_id is null) or(kind='staff' and company_id is not null and merchant_id is null)));
create unique index payout_paid_reference_idx on payout_requests(lower(payment_reference)) where status='paid';
-- Existing externally recorded settlements must not be duplicated under another ID.
create unique index settlement_recorded_reference_idx on settlements(lower(reference)) where status='recorded';
create function public.can_review_payout(p_kind text,p_company uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(auth.uid() is not null and case p_kind when 'merchant' then app_role()='admin' or business_role()='accounts' when 'staff' then company_role(p_company)='company_admin' or (p_company='10000000-0000-4000-8000-000000000001' and (app_role()='admin' or business_role()='accounts')) else false end,false)
$$;
create function public.eligible_merchant_balance(p_merchant text,p_exclude uuid default null) returns bigint language sql stable security definer set search_path=public as $$
 select greatest(0,coalesce((select sum(net_kobo) from merchant_ledger where merchant_id=p_merchant and status='pending_settlement'),0)-coalesce((select sum(amount_kobo) from settlements where merchant_id=p_merchant and status='recorded'),0)-coalesce((select sum(amount_kobo) from payout_requests where merchant_id=p_merchant and kind='merchant' and status in ('requested','approved') and id is distinct from p_exclude),0))::bigint
$$;
alter table payout_requests enable row level security;
revoke all on payout_requests from public,anon,authenticated;grant select on payout_requests to authenticated;
create policy payout_scoped_read on payout_requests for select using(owner_id=auth.uid() or can_review_payout(kind,company_id));
create function public.payout_context(p_kind text,p_company uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare can_request boolean:=false;can_review boolean;balance bigint;begin
 if auth.uid() is null or p_kind is null or p_kind not in ('merchant','staff') or (p_kind='staff' and p_company is null) or (p_kind='merchant' and p_company is not null) then raise exception 'Forbidden';end if;
 can_review:=can_review_payout(p_kind,p_company);
 if p_kind='merchant' then
  can_request:=coalesce(app_role()='merchant' and exists(select 1 from merchants where id=current_merchant() and status='approved'),false);
  if can_request then balance:=eligible_merchant_balance(current_merchant());end if;
 else can_request:=coalesce(company_role(p_company)='field_agent' and field_enabled(p_company),false);end if;
 if not can_request and not can_review and not exists(select 1 from payout_requests where owner_id=auth.uid() and kind=p_kind and company_id is not distinct from p_company) then raise exception 'Forbidden';end if;
 return jsonb_build_object('kind',p_kind,'company',p_company,'can_request',can_request,'can_review',can_review,'balance_kobo',balance);
end $$;
create function public.request_payout(p_id uuid,p_kind text,p_company uuid,p_amount bigint,p_payee jsonb,p_note text) returns void language plpgsql security definer set search_path=public as $$
declare context jsonb;prior payout_requests;merchant text;begin
 context:=payout_context(p_kind,p_company);
 if context->>'can_request' is distinct from 'true' or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed eligible account required';end if;
 if p_id is null or p_amount is null or p_amount not between 1 and 100000000000 or not valid_payout_payee(p_payee) or length(trim(coalesce(p_note,''))) not between 10 and 500 then raise exception 'Enter the amount, verified beneficiary details and request reason';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text||'-payout',0));
 select * into prior from payout_requests where id=p_id;if found then
  if prior.owner_id=auth.uid() and prior.kind=p_kind and prior.company_id is not distinct from p_company and prior.amount_kobo=p_amount and prior.payee=p_payee and prior.note=trim(p_note) then return;end if;raise exception 'Request ID already used. Check existing requests before starting another.';
 end if;
 if p_kind='merchant' then
  merchant:=current_merchant();perform pg_advisory_xact_lock(hashtextextended(merchant||'-payout-balance',0));
  if p_amount>eligible_merchant_balance(merchant) then raise exception 'Request exceeds eligible new-site ledger balance. Refund-review entries and existing requests are held.';end if;
 end if;
 insert into payout_requests(id,kind,owner_id,merchant_id,company_id,amount_kobo,payee,note) values(p_id,p_kind,auth.uid(),merchant,p_company,p_amount,p_payee,trim(p_note));
 perform audit('payout.requested',jsonb_build_object('id',p_id,'kind',p_kind,'amount_kobo',p_amount));
end $$;
create function public.review_payout(p_id uuid,p_action text,p_note text,p_reference text default '',p_checked boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare request payout_requests;ref text:=trim(coalesce(p_reference,''));begin
 select * into request from payout_requests where id=p_id for update;
 if not found or can_review_payout(request.kind,request.company_id) is distinct from true then raise exception 'Forbidden';end if;
 if request.owner_id=auth.uid() then raise exception 'Another authorized finance person must review your own payment request';end if;
 if p_action is null or p_action not in ('approve','reject','paid') or length(trim(coalesce(p_note,''))) not between 5 and 500 then raise exception 'Record a finance review reason';end if;
 if request.status='paid' and p_action='paid' and request.payment_reference=ref and p_checked then return;end if;
 if p_action='approve' and request.status<>'requested' or p_action='reject' and request.status not in ('requested','approved') or p_action='paid' and request.status<>'approved' then raise exception 'Request is not in the required review state';end if;
 if request.kind='merchant' then
  perform pg_advisory_xact_lock(hashtextextended(request.merchant_id||'-payout-balance',0));
  -- Lock eligible ledger rows against simultaneous refund-review changes.
  perform 1 from merchant_ledger where merchant_id=request.merchant_id order by id for update;
  if p_action in ('approve','paid') and request.amount_kobo>eligible_merchant_balance(request.merchant_id,request.id) then raise exception 'Ledger balance requires reconciliation before approval or payment recording';end if;
 end if;
 if p_action='paid' then
  if p_checked is distinct from true or length(ref) not between 6 and 150 then raise exception 'Confirm the completed bank transfer and its actual transaction reference';end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(ref)||'-payout-reference',0));
  if exists(select 1 from payout_requests where status='paid' and lower(payment_reference)=lower(ref) and id<>p_id) then raise exception 'Bank transaction reference already recorded';end if;
  if request.kind='merchant' then insert into settlements(id,merchant_id,amount_kobo,reference,status) values('withdrawal-'||request.id,request.merchant_id,request.amount_kobo,ref,'recorded');end if;
  update payout_requests set status='paid',payment_reference=ref,paid_at=now(),paid_by=auth.uid(),review_note=trim(p_note),updated_at=now() where id=p_id;
 else update payout_requests set status=case p_action when 'approve' then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=trim(p_note),updated_at=now() where id=p_id;end if;
 perform audit('payout.'||p_action,jsonb_build_object('id',p_id,'amount_kobo',request.amount_kobo));
end $$;
create function public.cancel_payout_request(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare request payout_requests;begin
 select * into request from payout_requests where id=p_id for update;
 if auth.uid() is null or request.owner_id is distinct from auth.uid() then raise exception 'Forbidden';end if;
 if request.status='cancelled' then return;end if;
 if request.status<>'requested' then raise exception 'Contact finance for an approved request. Paid requests cannot be cancelled.';end if;
 update payout_requests set status='cancelled',updated_at=now() where id=p_id;perform audit('payout.cancelled',jsonb_build_object('id',p_id));
end $$;
create function public.payout_list(p_kind text,p_company uuid default null,p_status text default '',p_page integer default 1,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare context jsonb;reviewer boolean;result jsonb;begin
 context:=payout_context(p_kind,p_company);reviewer:=(context->>'can_review')::boolean;
 if p_status is null or p_status not in ('','requested','approved','rejected','cancelled','paid') or p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid payout filters';end if;
 with matches as(select r.*,p.name requester from payout_requests r join profiles p on p.id=r.owner_id where r.kind=p_kind and r.company_id is not distinct from p_company and (reviewer or r.owner_id=auth.uid()) and (p_status='' or r.status=p_status)),paged as(select * from matches order by created_at desc,id limit p_limit offset (p_page-1)*p_limit)
 select jsonb_build_object('count',(select count(*) from matches),'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from paged x),'[]')) into result;return result;
end $$;
revoke all on function valid_payout_payee(jsonb),eligible_merchant_balance(text,uuid) from public,anon,authenticated;
revoke all on function can_review_payout(text,uuid),payout_context(text,uuid),request_payout(uuid,text,uuid,bigint,jsonb,text),review_payout(uuid,text,text,text,boolean),cancel_payout_request(uuid),payout_list(text,uuid,text,integer,integer) from public,anon;
grant execute on function can_review_payout(text,uuid),payout_context(text,uuid),request_payout(uuid,text,uuid,bigint,jsonb,text),review_payout(uuid,text,text,text,boolean),cancel_payout_request(uuid),payout_list(text,uuid,text,integer,integer) to authenticated;
