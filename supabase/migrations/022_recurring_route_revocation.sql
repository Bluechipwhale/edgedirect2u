-- Distinguish manager-scheduled visits from recurring route materialization.
alter table public.field_assignments add column source_route text;
create index field_assignment_source_route on public.field_assignments(company_id,agent_id,source_route,visit_date) where source_route is not null;
create or replace function public.field_assign(p_company uuid,p_store uuid,p_agent uuid,p_date date) returns uuid language plpgsql security definer set search_path=public as $$ declare aid uuid;begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if not exists(select 1 from platform_memberships where company_id=p_company and user_id=p_agent and role='field_agent' and active) then raise exception 'Select an active company field agent';end if;
 if not exists(select 1 from field_stores where company_id=p_company and id=p_store and active) then raise exception 'Store unavailable';end if;
 insert into field_assignments(company_id,store_id,agent_id,visit_date) values(p_company,p_store,p_agent,p_date)
 on conflict(company_id,store_id,agent_id,visit_date) do update set source_route=null returning id into aid;
 perform platform_log(p_company,'field.assigned',jsonb_build_object('assignment',aid,'agent',p_agent));return aid;
end $$;

create or replace function public.field_store_access(p_company uuid,p_store uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(company_role(p_company),'') in ('company_admin','supervisor') or
 (company_role(p_company)='field_agent' and exists(
 select 1 from field_stores s where s.company_id=p_company and s.id=p_store and s.active and
 (exists(select 1 from field_assignments a where a.company_id=p_company and a.store_id=s.id and a.agent_id=auth.uid() and a.source_route is null and a.visit_date=(now() at time zone 'Africa/Lagos')::date)
 or exists(select 1 from field_route_access r where r.company_id=p_company and r.route=s.route and r.agent_id=auth.uid() and r.active))))
$$;
create or replace function public.field_prepare_day(p_company uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then return;end if;
 delete from field_assignments a where a.company_id=p_company and a.agent_id=auth.uid() and a.source_route is not null and a.visit_date=(now() at time zone 'Africa/Lagos')::date
 and not exists(select 1 from field_visits v where v.company_id=a.company_id and v.assignment_id=a.id)
 and not exists(select 1 from field_stores s join field_route_access r on r.company_id=s.company_id and r.route=s.route and r.agent_id=a.agent_id and r.active where s.company_id=a.company_id and s.id=a.store_id and s.active and s.route=a.source_route);
 insert into field_assignments(company_id,store_id,agent_id,visit_date,source_route)
 select s.company_id,s.id,auth.uid(),(now() at time zone 'Africa/Lagos')::date,s.route from field_stores s join field_route_access r on r.company_id=s.company_id and r.route=s.route and r.agent_id=auth.uid() and r.active where s.company_id=p_company and s.active
 on conflict(company_id,store_id,agent_id,visit_date) do nothing;
end $$;
create function public.field_revoke_route_assignments() returns trigger language plpgsql security definer set search_path=public as $$ declare cid uuid;aid uuid;route_name text;begin
 if tg_op='DELETE' then cid:=old.company_id;aid:=old.agent_id;route_name:=old.route;
 else if new.active then return new;end if;cid:=new.company_id;aid:=new.agent_id;route_name:=new.route;end if;
 delete from field_assignments a where a.company_id=cid and a.agent_id=aid and a.source_route=route_name and a.visit_date>=(now() at time zone 'Africa/Lagos')::date
 and not exists(select 1 from field_visits v where v.company_id=a.company_id and v.assignment_id=a.id);
 return coalesce(new,old);
end $$;
create trigger field_route_revoked after insert or update or delete on public.field_route_access for each row execute function public.field_revoke_route_assignments();
create function public.field_move_outlet_assignments() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if old.route is not distinct from new.route and old.active is not distinct from new.active then return new;end if;
 delete from field_assignments a where a.company_id=new.company_id and a.store_id=new.id and a.source_route is not null and a.visit_date>=(now() at time zone 'Africa/Lagos')::date
 and not exists(select 1 from field_visits v where v.company_id=a.company_id and v.assignment_id=a.id);
 return new;
end $$;
create trigger field_outlet_route_changed after update of route,active on public.field_stores for each row execute function public.field_move_outlet_assignments();
create or replace function public.field_checkin(p_company uuid,p_assignment uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$ begin
 if not exists(select 1 from field_assignments a join field_stores s on s.company_id=a.company_id and s.id=a.store_id where a.company_id=p_company and a.id=p_assignment and a.agent_id=auth.uid() and s.latitude is not null and s.longitude is not null and field_store_access(p_company,s.id)) then raise exception 'Store location needs supervisor verification or assignment is unavailable';end if;
 return field_checkin_verified(p_company,p_assignment,p_lat,p_lng,p_accuracy,p_captured);
end $$;
revoke all on function field_revoke_route_assignments(),field_move_outlet_assignments(),field_store_access(uuid,uuid) from public,anon,authenticated;
