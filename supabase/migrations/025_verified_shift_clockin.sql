-- Shift start and outlet attendance share one atomic, location-verified operation.
alter table public.field_stores add column is_test boolean not null default false;
alter table public.field_shifts add column test_only boolean not null default false;
update public.platform_companies set geofence_metres=50 where id='10000000-0000-4000-8000-000000000001';

create or replace function public.company_field_policy(p_company uuid,p_radius integer,p_target integer,p_web boolean)
returns void language plpgsql security definer set search_path=public as $$ begin
 if company_role(p_company) is distinct from 'company_admin' then raise exception 'Forbidden';end if;
 if p_company='10000000-0000-4000-8000-000000000001' and (p_radius is null or p_radius>50) then raise exception 'The maximum clock-in radius is 50 metres';end if;
 if p_radius is null or p_radius not between 25 and 1000 or p_target is null or p_target not between 1 and 200 or p_web is null then raise exception 'Invalid field policy';end if;
 update platform_companies set geofence_metres=p_radius,daily_target=p_target,allow_web_checkin=p_web where id=p_company;
 perform platform_log(p_company,'company.field_policy',jsonb_build_object('radius',p_radius,'target',p_target,'web',p_web));
end $$;

create or replace function public.field_shift(p_company uuid,p_action text) returns void
language plpgsql security definer set search_path=public as $$ begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if p_action='in' then raise exception 'Choose an assigned store and use GPS to clock in';end if;
 if p_action is distinct from 'out' then raise exception 'Invalid shift action';end if;
 perform pg_advisory_xact_lock(hashtext(p_company::text),hashtext(auth.uid()::text));
 if exists(select 1 from field_visits where company_id=p_company and agent_id=auth.uid() and completed_at is null) then raise exception 'Complete the open visit before clocking out';end if;
 update field_shifts set ended_at=now() where company_id=p_company and agent_id=auth.uid() and ended_at is null;
 if found then perform platform_log(p_company,'field.shift.out');end if;
end $$;

create or replace function public.field_checkin(p_company uuid,p_assignment uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare c platform_companies;s field_stores;a field_assignments;vid uuid;distance double precision;radius integer;started boolean;
begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 select * into c from platform_companies where id=p_company;
 if not c.allow_web_checkin then raise exception 'Web check-in is disabled by company policy';end if;
 perform pg_advisory_xact_lock(hashtext(p_company::text),hashtext(auth.uid()::text));
 select * into a from field_assignments where company_id=p_company and id=p_assignment and agent_id=auth.uid() and visit_date=(now() at time zone 'Africa/Lagos')::date for update;
 if not found then raise exception 'Assigned store unavailable for today';end if;
 select * into s from field_stores where company_id=p_company and id=a.store_id and active;
 if not found or not coalesce(field_store_access(p_company,a.store_id),false) then raise exception 'Store unavailable or not assigned to you';end if;
 if s.latitude is null or s.longitude is null then raise exception 'Store location needs supervisor verification';end if;
 if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_accuracy is null or p_accuracy not between 0 and 50 or p_captured is null or p_captured<now()-interval '60 seconds' or p_captured>now()+interval '5 seconds' then raise exception 'Fresh location with accuracy of 50 metres or better is required';end if;
 radius:=coalesce(s.radius_metres,c.geofence_metres);
 if p_company='10000000-0000-4000-8000-000000000001' then radius:=least(50,radius);end if;
 distance:=field_distance(p_lat,p_lng,s.latitude,s.longitude);
 if distance+p_accuracy>radius then raise exception 'You are % metres from the store with % metres GPS uncertainty. Move inside the % metre geofence and retry',round(distance)::integer,ceil(p_accuracy)::integer,radius;end if;
 -- Repeated requests still require valid GPS; they never create a second visit.
 select id into vid from field_visits where company_id=p_company and assignment_id=p_assignment;
 if found then return vid;end if;
 if exists(select 1 from field_visits where company_id=p_company and agent_id=auth.uid() and completed_at is null) then raise exception 'Complete the open visit first';end if;
 insert into field_shifts(company_id,agent_id,test_only) values(p_company,auth.uid(),s.is_test)
 on conflict(company_id,agent_id) where ended_at is null do nothing;
 started:=found;
 if not s.is_test then update field_shifts set test_only=false,started_at=now() where company_id=p_company and agent_id=auth.uid() and ended_at is null and test_only;end if;
 insert into field_visits(company_id,assignment_id,agent_id,latitude,longitude,accuracy_metres,captured_at,distance_metres)
 values(p_company,p_assignment,auth.uid(),p_lat,p_lng,p_accuracy,p_captured,distance) returning id into vid;
 if started then perform platform_log(p_company,'field.shift.in',jsonb_build_object('verified_visit',vid,'test',s.is_test));end if;
 perform platform_log(p_company,'field.checkin',jsonb_build_object('visit',vid,'radius_metres',radius,'test',s.is_test));
 return vid;
end $$;

create or replace function public.field_start_visit(p_company uuid,p_store uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$ declare aid uuid;begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) or not coalesce(field_store_access(p_company,p_store),false) then raise exception 'Forbidden';end if;
 perform field_prepare_day(p_company);
 select id into aid from field_assignments where company_id=p_company and store_id=p_store and agent_id=auth.uid() and visit_date=(now() at time zone 'Africa/Lagos')::date;
 if aid is null then raise exception 'Store is not assigned to you today';end if;
 return field_checkin(p_company,aid,p_lat,p_lng,p_accuracy,p_captured);
end $$;

-- The retired verifier cannot be called to reach the old standalone shift flow.
revoke all on function field_checkin_verified(uuid,uuid,double precision,double precision,double precision,timestamptz) from public,anon,authenticated;
alter function public.field_override(uuid,uuid,text) rename to field_override_recorded;
revoke all on function field_override_recorded(uuid,uuid,text) from public,anon,authenticated;
create function public.field_override(p_company uuid,p_assignment uuid,p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$ begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') then raise exception 'Forbidden';end if;
 if p_company='10000000-0000-4000-8000-000000000001' then raise exception 'GPS verification is required. Remote supervisor clock-in is disabled';end if;
 return field_override_recorded(p_company,p_assignment,p_reason);
end $$;
revoke all on function field_override(uuid,uuid,text) from public,anon;
grant execute on function field_override(uuid,uuid,text) to authenticated;

create or replace function public.company_metrics(p_company uuid) returns jsonb language plpgsql stable security invoker set search_path=public as $$ begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor','field_agent') then raise exception 'Forbidden';end if;
 return jsonb_build_object(
 'stores',(select count(*) from field_stores where company_id=p_company and active and not is_test),
 'planned',(select count(*) from field_assignments a join field_stores s on s.company_id=a.company_id and s.id=a.store_id where a.company_id=p_company and a.visit_date=(now() at time zone 'Africa/Lagos')::date and not s.is_test),
 'completed',(select count(*) from field_visits v join field_assignments a on a.company_id=v.company_id and a.id=v.assignment_id join field_stores s on s.company_id=a.company_id and s.id=a.store_id where v.company_id=p_company and (v.completed_at at time zone 'Africa/Lagos')::date=(now() at time zone 'Africa/Lagos')::date and not s.is_test),
 'agents',(select count(*) from platform_memberships where company_id=p_company and active and role='field_agent'));
end $$;


create or replace function public.field_store_directory(p_company uuid,p_query text default '',p_route text default '',p_location text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=lower(trim(coalesce(p_query,'')));result jsonb;begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor','field_agent') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if length(q)>120 or length(coalesce(p_route,''))>250 or p_page not between 1 and 100000 or p_location not in ('all','ready','missing') then raise exception 'Invalid directory search';end if;
 with scoped as (select s.* from field_stores s where s.company_id=p_company and s.active and not s.is_test and field_store_access(p_company,s.id)),
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
 from field_assignments a join field_stores s on s.company_id=a.company_id and s.id=a.store_id left join field_visits v on v.company_id=a.company_id and v.assignment_id=a.id
 where a.company_id=p_company and not s.is_test and a.visit_date between p_from and p_to and (agent is null or a.agent_id=agent);
 n:=(summary->>'assigned')::integer;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.visit_date desc,x.route,x.route_sequence nulls last,x.outlet,x.assignment_id),'[]'::jsonb) into rows from (
  select a.id assignment_id,a.visit_date,a.agent_id,coalesce(nullif(m.label,''),p.name,'Team member') salesperson,
   s.id store_id,s.legacy_customer_id,s.name outlet,s.address,s.phone,s.route,s.route_sequence,s.location_review_reason,
   case when v.completed_at is not null then 'completed' when v.id is not null then 'visited' else 'assigned' end status,
   v.started_at,v.completed_at,v.override_reason,v.task_report->>'notes' notes
  from field_assignments a join field_stores s on s.company_id=a.company_id and s.id=a.store_id
  join platform_memberships m on m.company_id=a.company_id and m.user_id=a.agent_id join profiles p on p.id=a.agent_id
  left join field_visits v on v.company_id=a.company_id and v.assignment_id=a.id
  where a.company_id=p_company and not s.is_test and a.visit_date between p_from and p_to and (agent is null or a.agent_id=agent)
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

-- Test completion records no stock/contact assertions and ends only a test-only shift.
create function public.field_finish_test(p_company uuid,p_visit uuid) returns void
language plpgsql security definer set search_path=public as $$ declare v field_visits;begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 perform pg_advisory_xact_lock(hashtext(p_company::text),hashtext(auth.uid()::text));
 select fv.* into v from field_visits fv join field_assignments a on a.id=fv.assignment_id and a.company_id=fv.company_id
 join field_stores s on s.id=a.store_id and s.company_id=a.company_id
 where fv.id=p_visit and fv.company_id=p_company and fv.agent_id=auth.uid() and s.is_test for update of fv;
 if not found then raise exception 'Test visit unavailable';end if;
 if v.completed_at is not null then return;end if;
 update field_visits set completed_at=now(),task_report=jsonb_build_object('test',true,'notes','GPS clock-in test completed; no customer sales or stock checks recorded.') where id=p_visit;
 update field_shifts set ended_at=now() where company_id=p_company and agent_id=auth.uid() and ended_at is null and test_only;
 perform platform_log(p_company,'field.test_finished',jsonb_build_object('visit',p_visit));
end $$;
revoke all on function public.field_finish_test(uuid,uuid) from public,anon;
grant execute on function public.field_finish_test(uuid,uuid) to authenticated;

