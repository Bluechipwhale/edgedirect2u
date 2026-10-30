create function public.admin_report_dataset(p_kind text,p_from date,p_to date,p_page integer default 1,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare source_sql text;result jsonb;begin
 if auth.uid() is null or app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid report period or page';end if;
 source_sql:=case p_kind
 when 'payments' then 'select reference id,extract(epoch from verified_at) sort_value,to_jsonb(t) data from payments t where verified_at >= $1 and verified_at < $2'
 when 'refunds' then 'select id,extract(epoch from created_at) sort_value,to_jsonb(t) data from refunds t where created_at >= $1 and created_at < $2'
 when 'merchant_ledger' then 'select id::text,extract(epoch from created_at) sort_value,to_jsonb(t) data from merchant_ledger t where created_at >= $1 and created_at < $2'
 when 'settlements' then 'select id,extract(epoch from created_at) sort_value,to_jsonb(t) data from settlements t where created_at >= $1 and created_at < $2'
 when 'product_sales' then 'select i.product_id id,sum(i.quantity*i.price_kobo) sort_value,jsonb_build_object(''id'',i.product_id,''name'',max(i.name),''units'',sum(i.quantity),''gross_kobo'',sum(i.quantity*i.price_kobo)) data from order_items i join orders o on o.id=i.order_id where o.created_at >= $1 and o.created_at < $2 and o.payment_status=''paid'' group by i.product_id'
 when 'merchant_sales' then 'select a.merchant_id id,sum(a.total_kobo) sort_value,jsonb_build_object(''id'',a.merchant_id,''name'',max(m.name),''orders'',count(*),''gross_kobo'',sum(a.total_kobo)) data from order_allocations a join orders o on o.id=a.order_id join merchants m on m.id=a.merchant_id where o.created_at >= $1 and o.created_at < $2 and o.payment_status=''paid'' group by a.merchant_id'
 when 'customers' then 'select o.customer_id::text id,sum(o.total_kobo) sort_value,jsonb_build_object(''id'',o.customer_id,''name'',coalesce(nullif(max(p.name),''''),''Customer''),''paid_orders'',count(*),''order_value_kobo'',sum(o.total_kobo)) data from orders o join profiles p on p.id=o.customer_id where o.created_at >= $1 and o.created_at < $2 and o.payment_status=''paid'' group by o.customer_id'
 else null end;
 if source_sql is null then raise exception 'Unknown report dataset';end if;
 execute 'with matched as ('||source_sql||'),paged as(select * from matched order by sort_value desc,id limit $3 offset $4) select jsonb_build_object(''count'',(select count(*) from matched),''rows'',coalesce((select jsonb_agg(data||jsonb_build_object(''id'',id) order by sort_value desc,id) from paged),''[]''))'
 into result using p_from::timestamp at time zone 'Africa/Lagos',(p_to+1)::timestamp at time zone 'Africa/Lagos',p_limit,(p_page-1)*p_limit;
 return result;
end $$;
revoke all on function admin_report_dataset(text,date,date,integer,integer) from public,anon;
grant execute on function admin_report_dataset(text,date,date,integer,integer) to authenticated;
