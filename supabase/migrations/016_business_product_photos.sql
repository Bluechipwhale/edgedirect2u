-- Add product photos to the existing authorized report DTO. Scope and grants are unchanged.
create or replace function public.business_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r text:=business_role();scope text;result jsonb;begin
 if r is null then raise exception 'Forbidden';end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'Choose a date range of up to 366 days';end if;
 if r='client' then select principal_id into scope from business_access where user_id=auth.uid() and active;if scope is null then raise exception 'Forbidden';end if;end if;
 result:=jsonb_build_object('role',r,'from',p_from,'to',p_to);
 if r in ('administrator','warehouse_manager','client') then
  result:=result||jsonb_build_object('inventory',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'image',p.image,'name',p.name,'brand',p.brand,'active',p.active,'stock',p.stock,'reserved',p.reserved,'available',p.available_stock,'van_stock',coalesce((select sum(quantity) from business_van_stock where product_id=p.id),0),'principal_id',b.principal_id,'principal',bp.name,'benchmark_price_kobo',br.retail_price_kobo,'source',br.source_url,'verified_on',br.verified_on) order by p.name) from products p left join business_product_principals b on b.product_id=p.id left join business_principals bp on bp.id=b.principal_id left join business_research br on br.product_id=p.id where p.merchant_id='edge' and (r<>'client' or b.principal_id=scope)),'[]'::jsonb));
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
  result:=result||jsonb_build_object('van_stock',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'image',p.image,'name',p.name,'quantity',v.quantity,'price_kobo',p.price_kobo,'active',p.active) order by p.name) from business_van_stock v join products p on p.id=v.product_id where seller_id=auth.uid()),'[]'::jsonb));
 end if;
 return result;
end $$;
