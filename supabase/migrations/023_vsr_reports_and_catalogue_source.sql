-- Daily VSR reporting always follows company membership and the selected agent.
create function public.field_daily_report(p_company uuid,p_from date,p_to date,p_agent uuid default null,p_page integer default 1)
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
 select coalesce(jsonb_agg(to_jsonb(x) order by x.visit_date desc,x.outlet,x.assignment_id),'[]'::jsonb) into rows from (
  select a.id assignment_id,a.visit_date,a.agent_id,coalesce(nullif(m.label,''),p.name,'Team member') salesperson,
   s.id store_id,s.legacy_customer_id,s.name outlet,s.address,s.phone,s.route,
   case when v.completed_at is not null then 'completed' when v.id is not null then 'visited' else 'assigned' end status,
   v.started_at,v.completed_at,v.override_reason,v.task_report->>'notes' notes
  from field_assignments a join field_stores s on s.company_id=a.company_id and s.id=a.store_id
  join platform_memberships m on m.company_id=a.company_id and m.user_id=a.agent_id join profiles p on p.id=a.agent_id
  left join field_visits v on v.company_id=a.company_id and v.assignment_id=a.id
  where a.company_id=p_company and a.visit_date between p_from and p_to and (agent is null or a.agent_id=agent)
  order by a.visit_date desc,s.name,a.id limit 100 offset (p_page-1)*100
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

-- Original catalogue provenance is private and never carries passwords or orders.
create table public.legacy_catalogue_source(
 source_id text primary key,product_id text not null unique references products(id),source_sha256 text not null,
 source_price_kobo bigint not null,source_stock integer not null,source_active boolean not null,
 source_data jsonb not null,imported_at timestamptz not null default now()
);
alter table public.legacy_catalogue_source enable row level security;
revoke all on public.legacy_catalogue_source from public,anon,authenticated;
