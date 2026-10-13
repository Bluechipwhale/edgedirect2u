-- Server-only refund mutations. A claim is never retried after an ambiguous provider timeout.
create function public.claim_refund(p_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r refunds; ref text;begin
select * into r from refunds where id=p_id for update;
if not found or r.status<>'requested' then raise exception 'Refund already claimed or unavailable';end if;
update refunds set status='processing' where id=p_id;
select reference into ref from orders where id=r.order_id;
return to_jsonb(r)||jsonb_build_object('reference',ref);end $$;
create function public.reconcile_refund(p_id text,p_provider text,p_amount bigint,p_status text) returns void language plpgsql security definer set search_path=public as $$
declare r refunds; o orders;begin
select * into r from refunds where id=p_id for update;
if not found or r.status='requested' or r.amount_kobo<>p_amount or p_status not in ('processing','processed','failed') or p_provider!~'^[0-9]+$' then raise exception 'Refund verification mismatch';end if;
if r.provider_reference is not null and r.provider_reference<>p_provider then raise exception 'Refund verification mismatch';end if;
if r.status in ('processed','failed') and r.status<>p_status then raise exception 'Refund already finalized';end if;
select * into o from orders where id=r.order_id for update;
update refunds set provider_reference=p_provider,status=p_status where id=p_id;
if p_status='processed' then
update merchant_ledger set status='refund_review' where order_id=r.order_id;
if (select coalesce(sum(amount_kobo),0) from refunds where order_id=r.order_id and status='processed')=o.total_kobo then update orders set payment_status='refunded' where id=o.id;end if;
end if;
perform audit('refund.'||p_status,jsonb_build_object('id',p_id,'provider',p_provider));end $$;
revoke all on function claim_refund(text),reconcile_refund(text,text,bigint,text) from public,anon,authenticated;
grant execute on function claim_refund(text),reconcile_refund(text,text,bigint,text) to service_role;

create function public.dashboard_metrics() returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
if not is_staff() then raise exception 'Forbidden';end if;
return jsonb_build_object('revenue',(select coalesce(sum(total_kobo),0) from orders where payment_status in ('paid','refunded'))-(select coalesce(sum(amount_kobo),0) from refunds where status='processed'),'orders',(select count(*) from orders),'products',(select count(*) from products where active),'merchants',(select count(*) from merchants where status='approved'));end $$;
create function public.update_profile(p_name text) returns void language plpgsql security definer set search_path=public as $$ begin
if auth.uid() is null then raise exception 'Authentication required';end if;
if coalesce(length(trim(p_name)),0) not between 2 and 100 then raise exception 'Name must have 2 to 100 characters';end if;
update profiles set name=trim(p_name) where id=auth.uid();end $$;
revoke all on function dashboard_metrics(),update_profile(text) from public,anon;
grant execute on function dashboard_metrics(),update_profile(text) to authenticated;

create function public.public_reviews(p_product text) returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'rating',r.rating,'comment',r.comment,'created_at',r.created_at)),'[]') from (select * from reviews where product_id=p_product and status='published' order by created_at desc limit 30) r $$;
grant execute on function public_reviews(text) to anon,authenticated;

-- Public store discovery exposes presentation data; merchant accounts remain private.
drop policy merchant_read on merchants;
create policy merchant_read on merchants for select using(owner_id=auth.uid() or id=current_merchant() or is_staff());
create function public.approved_merchant(p_id text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from merchants where id=p_id and status='approved') $$;
drop policy products_read on products;
create policy products_read on products for select using((active and approved_merchant(merchant_id)) or is_staff() or merchant_id=current_merchant());
create function public.public_merchants() returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind','merchants','created_at',created_at,'data',jsonb_build_object('name',name,'description',description,'status',status))),'[]') from merchants where status='approved' $$;
grant execute on function approved_merchant(text),public_merchants() to anon,authenticated;

alter table merchants add column logo text not null default '',add column cover text not null default '';
create or replace function public.public_merchants() returns jsonb language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind','merchants','created_at',created_at,'data',jsonb_build_object('name',name,'description',description,'status',status,'logo',logo,'cover',cover))),'[]') from merchants where status='approved' $$;
create function public.update_merchant_profile(p_data jsonb) returns void language plpgsql security definer set search_path=public as $$ begin
if app_role()<>'merchant' then raise exception 'Forbidden';end if;
if coalesce(length(trim(p_data->>'name')),0) not between 2 and 100 or coalesce(length(p_data->>'description'),0)>1000 or coalesce(p_data->>'logo','')!~'^(https://|$)' or coalesce(p_data->>'cover','')!~'^(https://|$)' then raise exception 'Invalid store profile';end if;
update merchants set name=p_data->>'name',description=coalesce(p_data->>'description',''),logo=coalesce(p_data->>'logo',''),cover=coalesce(p_data->>'cover','') where id=current_merchant() and status='approved';
if not found then raise exception 'Merchant approval required';end if;update products set merchant_name=p_data->>'name' where merchant_id=current_merchant();perform audit('merchant.profile',jsonb_build_object('merchant',current_merchant()));end $$;
revoke all on function update_merchant_profile(jsonb) from public,anon;
grant execute on function update_merchant_profile(jsonb) to authenticated;
create function public.set_driver_availability(p_available boolean) returns void language plpgsql security definer set search_path=public as $$ begin
if app_role()<>'driver' then raise exception 'Forbidden';end if;update drivers set available=p_available where user_id=auth.uid();if not found then raise exception 'Driver record unavailable';end if;perform audit('driver.availability',jsonb_build_object('available',p_available));end $$;
revoke all on function set_driver_availability(boolean) from public,anon;
grant execute on function set_driver_availability(boolean) to authenticated;
