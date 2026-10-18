-- Ordered GPS routes retain original coordinates and existing company/agent policies.
alter table public.field_stores add column route_sequence integer check(route_sequence>0);
alter table public.field_stores add column routing_batch text;
alter table public.field_stores add column location_review_reason text not null default '' check(length(location_review_reason)<=500);
create function public.field_route_order_reset() returns trigger language plpgsql set search_path=public as $$ begin
 if old.routing_batch is not distinct from new.routing_batch and (old.route is distinct from new.route or old.latitude is distinct from new.latitude or old.longitude is distinct from new.longitude) then
  new.route_sequence:=null;new.routing_batch:=null;
 end if;return new;end $$;
create trigger field_route_order_changed before update of route,latitude,longitude on public.field_stores for each row execute function public.field_route_order_reset();
revoke all on function field_route_order_reset() from public,anon,authenticated;
create or replace function public.field_schedule(p_company uuid) returns setof field_assignments language sql stable security invoker set search_path=public as $$
 select a.* from field_assignments a left join field_stores s on s.company_id=a.company_id and s.id=a.store_id
 where a.company_id=p_company and a.visit_date between (now() at time zone 'Africa/Lagos')::date-7 and (now() at time zone 'Africa/Lagos')::date+14
 order by (a.visit_date=(now() at time zone 'Africa/Lagos')::date) desc,a.visit_date desc,s.route,s.route_sequence nulls last,s.name,a.id limit 200 $$;

create or replace function public.field_store_directory(p_company uuid,p_query text default '',p_route text default '',p_location text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=lower(trim(coalesce(p_query,'')));result jsonb;begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor','field_agent') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if length(q)>120 or length(coalesce(p_route,''))>250 or p_page not between 1 and 100000 or p_location not in ('all','ready','missing') then raise exception 'Invalid directory search';end if;
 with scoped as (select s.* from field_stores s where s.company_id=p_company and s.active and field_store_access(p_company,s.id)),
 matches as(select s.* from scoped s where (q='' or position(q in lower(concat_ws(' ',s.name,s.address,s.phone,s.route,s.legacy_customer_id)))>0)
 and (coalesce(p_route,'')='' or (p_route='__unassigned__' and s.route='') or s.route=p_route) and (p_location='all' or (p_location='ready' and s.latitude is not null) or (p_location='missing' and s.latitude is null))),
 paged as(select * from matches order by route,route_sequence nulls last,name,id limit 40 offset (p_page-1)*40)
 select jsonb_build_object('count',(select count(*) from matches),'total',(select count(*) from scoped),
 'located',(select count(*) from scoped where latitude is not null),'missing',(select count(*) from scoped where latitude is null),
 'routes',coalesce((select jsonb_agg(jsonb_build_object('name',route,'count',n) order by route) from(select route,count(*) n from scoped where route<>'' group by route) r),'[]'::jsonb),
 'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.route,p.route_sequence nulls last,p.name,p.id) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;

-- Daily VSR reporting always follows company membership and the selected agent.
create or replace function public.field_daily_report(p_company uuid,p_from date,p_to date,p_agent uuid default null,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r text:=company_role(p_company);agent uuid:=p_agent;n integer;summary jsonb;rows jsonb;sales jsonb;
begin
 if auth.uid() is null or coalesce(r,'') not in ('company_admin','supervisor','field_agent') then raise exception 'Forbidden';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_page is null or p_page<1 or p_page>100000 then raise exception 'Invalid reporting period or page';end if;
 if r='field_agent' then
  if agent is not null and agent<>auth.uid() then raise exception 'Forbidden';end if;agent:=auth.uid();
 elsif agent is not null and not exists(select 1 from platform_memberships where company_id=p_company and user_id=agent and role='field_agent') then raise exception 'Unknown salesperson';end if;
 select jsonb_build_object('assigned',count(*),'unique_outlets',count(distinct a.store_id),'visited',count(v.id),
  'completed',count(*) filter(where v.completed_at is not null),'remaining',count(*) filter(where v.id is null),
  'in_progress',count(*) filter(where v.id is not null and v.completed_at is null)) into summary
 from field_assignments a left join field_visits v on v.company_id=a.company_id and v.assignment_id=a.id
 where a.company_id=p_company and a.visit_date between p_from and p_to and (agent is null or a.agent_id=agent);
 n:=(summary->>'assigned')::integer;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.visit_date desc,x.route,x.route_sequence nulls last,x.outlet,x.assignment_id),'[]'::jsonb) into rows from (
  select a.id assignment_id,a.visit_date,a.agent_id,coalesce(nullif(m.label,''),p.name,'Team member') salesperson,
   s.id store_id,s.legacy_customer_id,s.name outlet,s.address,s.phone,s.route,s.route_sequence,s.location_review_reason,
   case when v.completed_at is not null then 'completed' when v.id is not null then 'visited' else 'assigned' end status,
   v.started_at,v.completed_at,v.override_reason,v.task_report->>'notes' notes
  from field_assignments a join field_stores s on s.company_id=a.company_id and s.id=a.store_id
  join platform_memberships m on m.company_id=a.company_id and m.user_id=a.agent_id join profiles p on p.id=a.agent_id
  left join field_visits v on v.company_id=a.company_id and v.assignment_id=a.id
  where a.company_id=p_company and a.visit_date between p_from and p_to and (agent is null or a.agent_id=agent)
  order by a.visit_date desc,s.route,s.route_sequence nulls last,s.name,a.id limit 100 offset (p_page-1)*100
 ) x;
 sales:=jsonb_build_object('transactions',0,'units',0,'amount_kobo',0,'cash_confirmed_kobo',0);
 if p_company='10000000-0000-4000-8000-000000000001' then
  select jsonb_build_object('transactions',count(*),'units',coalesce(sum(s.quantity),0),
   'amount_kobo',coalesce(sum(s.quantity::bigint*s.unit_price_kobo),0),
   'cash_confirmed_kobo',coalesce(sum(s.quantity::bigint*s.unit_price_kobo) filter(where s.cash_confirmed_at is not null),0)) into sales
  from business_van_sales s where s.created_at >= (p_from::timestamp at time zone 'Africa/Lagos')
   and s.created_at < ((p_to+1)::timestamp at time zone 'Africa/Lagos') and (agent is null or s.seller_id=agent)
   and exists(select 1 from platform_memberships m where m.company_id=p_company and m.user_id=s.seller_id and m.role='field_agent');
 end if;
 return jsonb_build_object('from',p_from,'to',p_to,'timezone','Africa/Lagos','summary',summary,'sales',sales,'count',n,'page',p_page,'page_size',100,'rows',rows);
end $$;
revoke all on function public.field_daily_report(uuid,date,date,uuid,integer) from public,anon;
grant execute on function public.field_daily_report(uuid,date,date,uuid,integer) to authenticated;

