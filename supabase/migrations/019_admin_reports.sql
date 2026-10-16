-- Live marketplace reports for the authorized administrator. Historical data in
-- the older .com.ng installation is intentionally outside these totals.
create function public.admin_reporting(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare start_at timestamptz;end_at timestamptz;
begin
 if app_role()<>'admin' then raise exception 'Forbidden';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'Choose a date range of at most 366 days';end if;
 start_at:=p_from::timestamp at time zone 'Africa/Lagos';
 end_at:=(p_to+1)::timestamp at time zone 'Africa/Lagos';
 return jsonb_build_object(
  'from',p_from,'to',p_to,
  'overview',jsonb_build_object(
   'orders',(select count(*) from orders where created_at>=start_at and created_at<end_at),
   'paid_orders',(select count(*) from orders where created_at>=start_at and created_at<end_at and payment_status='paid'),
   'verified_payments_kobo',(select coalesce(sum(amount_kobo),0) from payments where verified_at>=start_at and verified_at<end_at),
   'processed_refunds_kobo',(select coalesce(sum(amount_kobo),0) from refunds where status='processed' and created_at>=start_at and created_at<end_at),
   'active_products',(select count(*) from products where active),
   'inactive_products',(select count(*) from products where not active),
   'warehouse_units',(select coalesce(sum(stock),0) from products),
   'van_units',(select coalesce(sum(quantity),0) from business_van_stock)),
  'order_status',coalesce((select jsonb_agg(jsonb_build_object('status',status,'payment_status',payment_status,'count',n) order by status,payment_status) from (select status,payment_status,count(*) n from orders where created_at>=start_at and created_at<end_at group by status,payment_status) s),'[]'::jsonb),
  'product_sales',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'quantity',quantity,'gross_kobo',gross_kobo) order by gross_kobo desc,id) from (select i.product_id id,max(i.name) name,sum(i.quantity) quantity,sum(i.quantity*i.price_kobo) gross_kobo from order_items i join orders o on o.id=i.order_id where o.payment_status='paid' and o.created_at>=start_at and o.created_at<end_at group by i.product_id order by gross_kobo desc limit 100) s),'[]'::jsonb),
  'merchant_sales',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'orders',orders,'gross_kobo',gross_kobo) order by gross_kobo desc,id) from (select a.merchant_id id,max(m.name) name,count(*) orders,sum(a.total_kobo) gross_kobo from order_allocations a join orders o on o.id=a.order_id join merchants m on m.id=a.merchant_id where o.payment_status='paid' and o.created_at>=start_at and o.created_at<end_at group by a.merchant_id order by gross_kobo desc limit 100) s),'[]'::jsonb),
  'top_customers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'orders',orders,'gross_kobo',gross_kobo) order by gross_kobo desc,id) from (select o.customer_id id,coalesce(nullif(max(p.name),''),'Customer '||left(o.customer_id::text,8)) name,count(*) orders,sum(o.total_kobo) gross_kobo from orders o join profiles p on p.id=o.customer_id where o.payment_status='paid' and o.created_at>=start_at and o.created_at<end_at group by o.customer_id order by gross_kobo desc limit 50) s),'[]'::jsonb),
  'drivers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'deliveries',deliveries) order by deliveries desc,id) from (select d.id,max(d.name) name,count(distinct j.id) deliveries from delivery_jobs j join delivery_events e on e.delivery_id=j.id and e.status='delivered' and e.created_at>=start_at and e.created_at<end_at join drivers d on d.user_id=j.driver_id group by d.id order by deliveries desc limit 50) s),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object('reference',reference,'amount_kobo',amount_kobo,'verified_at',verified_at) order by verified_at desc) from (select reference,amount_kobo,verified_at from payments where verified_at>=start_at and verified_at<end_at order by verified_at desc limit 100) s),'[]'::jsonb),
  'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',id,'order_id',order_id,'amount_kobo',amount_kobo,'status',status,'created_at',created_at) order by created_at desc) from (select id,order_id,amount_kobo,status,created_at from refunds where created_at>=start_at and created_at<end_at order by created_at desc limit 100) s),'[]'::jsonb)
 );
end $$;
revoke all on function public.admin_reporting(date,date) from public,anon;
grant execute on function public.admin_reporting(date,date) to authenticated;
