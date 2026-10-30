create table public.order_workflow_events(id uuid primary key default gen_random_uuid(),order_id uuid not null references orders(id),stage text not null check(stage in ('packaging','cancelled')),note text not null,actor uuid not null references profiles(id),created_at timestamptz not null default now());
alter table order_workflow_events enable row level security;
create policy workflow_staff_read on order_workflow_events for select using(is_staff());
revoke all on order_workflow_events from public,anon,authenticated;grant select on order_workflow_events to authenticated;
create index order_workflow_recent_idx on order_workflow_events(order_id,created_at desc,id);
create index return_order_state_idx on returns(order_id,status);
create function public.order_queue_name(p_order uuid) returns text language sql stable security definer set search_path=public as $$
 select case
 when exists(select 1 from returns where order_id=o.id and status='received') then 'returned'
 when o.status='delivered' then 'delivered'
 when j.status='failed' then 'failed'
 when j.status in ('picked_up','in_transit') then 'out_for_delivery'
 when o.status='expired' then 'cancelled'
 when o.status='awaiting_payment' then 'pending'
 when o.status='ready_for_dispatch' or exists(select 1 from order_workflow_events where order_id=o.id and stage='packaging') then 'packaging'
 else 'confirmed' end from orders o left join delivery_jobs j on j.order_id=o.id where o.id=p_order
$$;
create function public.admin_order_queue(p_query text default '',p_queue text default '',p_payment text default '',p_from date default current_date-30,p_to date default current_date,p_page integer default 1,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;q text:=lower(trim(coalesce(p_query,'')));begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;
 if length(q)>120 or p_queue is null or p_queue not in ('','pending','confirmed','packaging','out_for_delivery','delivered','returned','failed','cancelled') or p_payment is null or p_payment not in ('','pending','paid','refunded') or p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid order filters';end if;
 with matching as(select o.id,o.created_at,order_queue_name(o.id) queue from orders o where o.created_at>=p_from::timestamp at time zone 'Africa/Lagos' and o.created_at<(p_to+1)::timestamp at time zone 'Africa/Lagos' and (p_payment='' or o.payment_status=p_payment) and (q='' or strpos(lower(concat_ws(' ',o.id::text,o.reference,o.address->>'name',o.address->>'phone',o.address->>'email')),q)>0)),
 filtered as(select * from matching where p_queue='' or queue=p_queue),paged as(select * from filtered order by created_at desc,id limit p_limit offset (p_page-1)*p_limit)
 select jsonb_build_object('count',(select count(*) from filtered),'queues',coalesce((select jsonb_object_agg(queue,n) from(select queue,count(*) n from matching group by queue) x),'{}'),'orders',coalesce((select jsonb_agg(order_json(p.id)||jsonb_build_object('queue',p.queue) order by p.created_at desc,p.id) from paged p),'[]')) into result;return result;
end $$;
create function public.set_order_workflow(p_order uuid,p_stage text,p_note text) returns void language plpgsql security definer set search_path=public as $$
declare o orders;r stock_reservations;begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;
 if p_stage is null or p_stage not in ('packaging','cancelled') or length(trim(coalesce(p_note,''))) not between 3 and 500 then raise exception 'Record a workflow reason';end if;
 select * into o from orders where id=p_order for update;if not found then raise exception 'Order not found';end if;
 if exists(select 1 from order_workflow_events where order_id=p_order and stage=p_stage) then return;end if;
 if p_stage='cancelled' then
  if o.status<>'awaiting_payment' or o.payment_status<>'pending' then raise exception 'Only unpaid reservations can be cancelled here. Paid orders require refund review.';end if;
  for r in select * from stock_reservations where order_id=p_order and status='active' order by product_id loop
   update products set reserved=reserved-r.quantity where id=r.product_id;insert into stock_movements(product_id,order_id,quantity,reason,actor) values(r.product_id,p_order,r.quantity,'Unpaid order cancelled: '||trim(p_note),auth.uid());
  end loop;
  update stock_reservations set status='released' where order_id=p_order and status='active';update orders set status='expired' where id=p_order;update order_allocations set status='cancelled' where order_id=p_order;
 else
  if o.status<>'processing' or o.payment_status<>'paid' then raise exception 'Only paid processing orders can enter packaging';end if;
 end if;
 insert into order_workflow_events(order_id,stage,note,actor) values(p_order,p_stage,trim(p_note),auth.uid());perform audit('order.'||p_stage,jsonb_build_object('order',p_order,'note',trim(p_note)));
end $$;
revoke all on function order_queue_name(uuid) from public,anon,authenticated;
revoke all on function admin_order_queue(text,text,text,date,date,integer,integer),set_order_workflow(uuid,text,text) from public,anon;
grant execute on function admin_order_queue(text,text,text,date,date,integer,integer),set_order_workflow(uuid,text,text) to authenticated;
