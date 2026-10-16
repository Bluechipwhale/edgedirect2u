-- Customer outlets are operational records; they do not require customer Auth accounts.
alter table public.field_stores alter column latitude drop not null;
alter table public.field_stores alter column longitude drop not null;
alter table public.field_stores add constraint field_coordinates_paired check((latitude is null)=(longitude is null));
alter table public.field_stores add column legacy_customer_id text references public.legacy_customers(source_id);
alter table public.field_stores add column phone text not null default '';
alter table public.field_stores add column route text not null default '';
alter table public.field_stores add column location_source text not null default 'manual' check(location_source in ('manual','legacy','captured','missing'));
alter table public.field_stores add column location_updated_at timestamptz;
alter table public.field_stores add constraint field_legacy_customer_unique unique(company_id,legacy_customer_id);
create index field_store_route_idx on public.field_stores(company_id,route,name);

create table public.field_route_access(
 company_id uuid not null references platform_companies(id),route text not null check(length(trim(route)) between 1 and 250),
 agent_id uuid not null,active boolean not null default true,assigned_by uuid references profiles(id),updated_at timestamptz not null default now(),
 primary key(company_id,route,agent_id),foreign key(company_id,agent_id) references platform_memberships(company_id,user_id)
);
create table public.field_location_requests(
 company_id uuid not null, id uuid not null default gen_random_uuid(),store_id uuid not null,agent_id uuid not null references profiles(id),
 latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),
 accuracy_metres double precision not null check(accuracy_metres between 0 and 50),captured_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),reviewed_by uuid references profiles(id),reviewed_at timestamptz,
 created_at timestamptz not null default now(),primary key(company_id,id),foreign key(company_id,store_id) references field_stores(company_id,id)
);
create unique index field_one_pending_location on field_location_requests(company_id,store_id,agent_id) where status='pending';
create table public.company_staff_invitations(
 company_id uuid not null references platform_companies(id),email text not null check(email=lower(trim(email))),
 name text not null check(length(name) between 2 and 160),phone text not null default '',
 role text not null check(role in ('van_sales','supervisor','company_admin','warehouse_manager','accounts','it_manager','client','delivery_driver')),
 principal_id text references business_principals(id),active boolean not null default true,
 approved_by uuid not null references profiles(id),claimed_user_id uuid references profiles(id),claimed_at timestamptz,
 last_email_at timestamptz,last_email_error text,updated_at timestamptz not null default now(),
 primary key(company_id,email),check((role='client' and principal_id is not null) or (role<>'client' and principal_id is null))
);
do $$ declare t text;begin foreach t in array array['field_route_access','field_location_requests','company_staff_invitations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop;end $$;

create function public.field_store_access(p_company uuid,p_store uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(company_role(p_company),'') in ('company_admin','supervisor') or
 (company_role(p_company)='field_agent' and exists(
 select 1 from field_stores s where s.company_id=p_company and s.id=p_store and s.active and
 (exists(select 1 from field_assignments a where a.company_id=p_company and a.store_id=s.id and a.agent_id=auth.uid() and a.visit_date=(now() at time zone 'Africa/Lagos')::date)
 or exists(select 1 from field_route_access r where r.company_id=p_company and r.route=s.route and r.agent_id=auth.uid() and r.active))))
$$;
revoke all on function field_store_access(uuid,uuid) from public,anon,authenticated;

create function public.field_store_directory(p_company uuid,p_query text default '',p_route text default '',p_location text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=lower(trim(coalesce(p_query,'')));result jsonb;begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor','field_agent') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if length(q)>120 or length(coalesce(p_route,''))>250 or p_page not between 1 and 100000 or p_location not in ('all','ready','missing') then raise exception 'Invalid directory search';end if;
 with scoped as (select s.* from field_stores s where s.company_id=p_company and s.active and field_store_access(p_company,s.id)),
 matches as(select s.* from scoped s where (q='' or position(q in lower(concat_ws(' ',s.name,s.address,s.phone,s.route,s.legacy_customer_id)))>0)
 and (coalesce(p_route,'')='' or (p_route='__unassigned__' and s.route='') or s.route=p_route) and (p_location='all' or (p_location='ready' and s.latitude is not null) or (p_location='missing' and s.latitude is null))),
 paged as(select * from matches order by name,id limit 40 offset (p_page-1)*40)
 select jsonb_build_object('count',(select count(*) from matches),'total',(select count(*) from scoped),
 'located',(select count(*) from scoped where latitude is not null),'missing',(select count(*) from scoped where latitude is null),
 'routes',coalesce((select jsonb_agg(jsonb_build_object('name',route,'count',n) order by route) from(select route,count(*) n from scoped where route<>'' group by route) r),'[]'::jsonb),
 'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.field_save_outlet(p_company uuid,p_id uuid,p_name text,p_address text,p_phone text,p_route text,p_lat double precision,p_lng double precision)
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid:=coalesce(p_id,gen_random_uuid());begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if length(trim(p_name)) not between 2 and 100 or length(trim(p_address)) not between 5 and 500 or length(p_phone)>40 or length(p_route)>250 or (p_lat is null)<>(p_lng is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180 or (p_lat=0 and p_lng=0))) then raise exception 'Check outlet name, address and coordinate pair';end if;
 if p_id is not null and not exists(select 1 from field_stores where company_id=p_company and id=p_id) then raise exception 'Store unavailable';end if;
 insert into field_stores(company_id,id,name,address,phone,route,latitude,longitude,location_source,location_updated_at)
 values(p_company,sid,trim(p_name),trim(p_address),trim(p_phone),trim(p_route),p_lat,p_lng,case when p_lat is null then 'missing' else 'manual' end,case when p_lat is not null then now() end)
 on conflict(company_id,id) do update set name=excluded.name,address=excluded.address,phone=excluded.phone,route=excluded.route,latitude=excluded.latitude,longitude=excluded.longitude,location_source=case when field_stores.latitude is distinct from excluded.latitude or field_stores.longitude is distinct from excluded.longitude then excluded.location_source else field_stores.location_source end,location_updated_at=case when field_stores.latitude is distinct from excluded.latitude or field_stores.longitude is distinct from excluded.longitude then now() else field_stores.location_updated_at end;
 perform platform_log(p_company,'field.outlet.saved',jsonb_build_object('store',sid));return sid;
end $$;

create function public.field_set_route(p_company uuid,p_route text,p_agent uuid,p_active boolean) returns void
language plpgsql security definer set search_path=public as $$ begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if p_active is null or length(trim(p_route)) not between 1 and 250 or not exists(select 1 from field_stores where company_id=p_company and route=trim(p_route) and active) then raise exception 'Select an existing route';end if;
 if not exists(select 1 from platform_memberships where company_id=p_company and user_id=p_agent and role='field_agent' and active) then raise exception 'Select an active van salesperson';end if;
 insert into field_route_access(company_id,route,agent_id,active,assigned_by) values(p_company,trim(p_route),p_agent,p_active,auth.uid())
 on conflict(company_id,route,agent_id) do update set active=excluded.active,assigned_by=auth.uid(),updated_at=now();
 perform platform_log(p_company,'field.route.assigned',jsonb_build_object('route',trim(p_route),'agent',p_agent,'active',p_active));
end $$;
create function public.field_bulk_route(p_company uuid,p_stores uuid[],p_route text,p_agent uuid default null) returns void language plpgsql security definer set search_path=public as $$ begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 if coalesce(array_length(p_stores,1),0) not between 1 and 100 or p_route is null or length(trim(p_route)) not between 1 and 250 or p_route='__unassigned__' then raise exception 'Select up to 100 customers and a named route';end if;
 if exists(select 1 from unnest(p_stores) as x(store_id) where x.store_id is null or not exists(select 1 from field_stores s where s.id=x.store_id and s.company_id=p_company and s.active)) then raise exception 'Customer unavailable';end if;
 update field_stores set route=trim(p_route) where company_id=p_company and id=any(p_stores);
 if p_agent is not null then perform field_set_route(p_company,trim(p_route),p_agent,true);end if;
 perform platform_log(p_company,'field.route.customers',jsonb_build_object('route',trim(p_route),'customers',array_length(p_stores,1)));
end $$;
revoke all on function field_bulk_route(uuid,uuid[],text,uuid) from public,anon;
grant execute on function field_bulk_route(uuid,uuid[],text,uuid) to authenticated;
create function public.field_route_plan(p_company uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') then raise exception 'Forbidden';end if;
 return jsonb_build_object('routes',coalesce((select jsonb_agg(jsonb_build_object('route',route,'agent_id',agent_id,'active',active) order by route) from field_route_access where company_id=p_company),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(x) from(select r.id,r.store_id,s.name,r.latitude,r.longitude,r.accuracy_metres,r.captured_at from field_location_requests r join field_stores s on s.company_id=r.company_id and s.id=r.store_id where r.company_id=p_company and r.status='pending' order by r.created_at limit 100) x),'[]'::jsonb));
end $$;
create function public.field_prepare_day(p_company uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then return;end if;
 insert into field_assignments(company_id,store_id,agent_id,visit_date)
 select s.company_id,s.id,auth.uid(),(now() at time zone 'Africa/Lagos')::date from field_stores s join field_route_access r on r.company_id=s.company_id and r.route=s.route and r.agent_id=auth.uid() and r.active where s.company_id=p_company and s.active
 on conflict(company_id,store_id,agent_id,visit_date) do nothing;
end $$;

-- Guard unknown store coordinates before the original, unchanged geofence verifier.
alter function public.field_checkin(uuid,uuid,double precision,double precision,double precision,timestamptz) rename to field_checkin_verified;
revoke all on function field_checkin_verified(uuid,uuid,double precision,double precision,double precision,timestamptz) from public,anon,authenticated;
create function public.field_checkin(p_company uuid,p_assignment uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$ begin
 if not exists(select 1 from field_assignments a join field_stores s on s.company_id=a.company_id and s.id=a.store_id where a.company_id=p_company and a.id=p_assignment and a.agent_id=auth.uid() and s.latitude is not null and s.longitude is not null) then raise exception 'Store location needs supervisor verification or assignment is unavailable';end if;
 return field_checkin_verified(p_company,p_assignment,p_lat,p_lng,p_accuracy,p_captured);
end $$;
create function public.field_start_visit(p_company uuid,p_store uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$ declare aid uuid;begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) or not coalesce(field_store_access(p_company,p_store),false) then raise exception 'Forbidden';end if;
 perform field_prepare_day(p_company);
 select id into aid from field_assignments where company_id=p_company and store_id=p_store and agent_id=auth.uid() and visit_date=(now() at time zone 'Africa/Lagos')::date;
 if aid is null then raise exception 'Store is not assigned to you today';end if;
 perform field_shift(p_company,'in');
 return field_checkin(p_company,aid,p_lat,p_lng,p_accuracy,p_captured);
end $$;
create function public.field_propose_location(p_company uuid,p_store uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$ declare rid uuid;begin
 if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) or not coalesce(field_store_access(p_company,p_store),false) then raise exception 'Forbidden';end if;
 if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 or (p_lat=0 and p_lng=0) or p_accuracy is null or p_accuracy not between 0 and 50 or p_captured is null or p_captured<now()-interval '60 seconds' or p_captured>now()+interval '5 seconds' then raise exception 'Use a fresh, accurate location reading';end if;
 insert into field_location_requests(company_id,store_id,agent_id,latitude,longitude,accuracy_metres,captured_at)
 values(p_company,p_store,auth.uid(),p_lat,p_lng,p_accuracy,p_captured)
 on conflict(company_id,store_id,agent_id) where status='pending' do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_metres=excluded.accuracy_metres,captured_at=excluded.captured_at returning id into rid;
 perform platform_log(p_company,'field.location.proposed',jsonb_build_object('store',p_store,'request',rid));return rid;
end $$;
create function public.field_review_location(p_company uuid,p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$ declare r field_location_requests;begin
 if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
 select * into r from field_location_requests where company_id=p_company and id=p_request for update;
 if not found or r.status<>'pending' or p_approve is null then raise exception 'Pending location request unavailable';end if;
 if p_approve then update field_stores set latitude=r.latitude,longitude=r.longitude,location_source='captured',location_updated_at=now() where company_id=p_company and id=r.store_id;end if;
 update field_location_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where company_id=p_company and id=p_request;
 perform platform_log(p_company,'field.location.reviewed',jsonb_build_object('request',p_request,'approved',p_approve));
end $$;

create function public.company_prepare_staff(p_company uuid,p_email text,p_name text,p_phone text,p_role text,p_principal text default null)
returns jsonb language plpgsql security definer set search_path=public as $$ declare uid uuid;old_access business_access;begin
 if company_role(p_company) is distinct from 'company_admin' then raise exception 'Forbidden';end if;
 p_email:=lower(trim(p_email));
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254 or length(trim(p_name)) not between 2 and 160 or length(p_phone)>40 or p_role not in ('van_sales','supervisor','company_admin','warehouse_manager','accounts','it_manager','client','delivery_driver') then raise exception 'Check staff name, email and role';end if;
 select id into uid from auth.users u where lower(to_jsonb(u)->>'email')=p_email;
 if uid=auth.uid() or exists(select 1 from platform_admins where user_id=uid) then raise exception 'Owner access is protected';end if;
 if p_role in ('warehouse_manager','accounts','it_manager','client','delivery_driver') and (p_company<>'10000000-0000-4000-8000-000000000001' or app_role()<>'admin') then raise exception 'This role requires flagship administration';end if;
 if p_company='10000000-0000-4000-8000-000000000001' then
  select * into old_access from business_access where email=p_email and active;
  if found then perform business_set_access(p_email,old_access.role,old_access.principal_id,false);end if;
 end if;
 update platform_memberships set active=false where company_id=p_company and user_id=uid;
 if p_role in ('warehouse_manager','accounts','it_manager','client') or (p_role='van_sales' and p_company='10000000-0000-4000-8000-000000000001') then
  perform business_set_access(p_email,p_role,p_principal,true);
 end if;
 insert into company_staff_invitations(company_id,email,name,phone,role,principal_id,approved_by)
 values(p_company,p_email,trim(p_name),trim(p_phone),p_role,p_principal,auth.uid())
 on conflict(company_id,email) do update set name=excluded.name,phone=excluded.phone,role=excluded.role,principal_id=excluded.principal_id,active=true,claimed_user_id=null,claimed_at=null,last_email_error=null,approved_by=auth.uid(),updated_at=now();
 perform platform_log(p_company,'company.staff.approved',jsonb_build_object('email',p_email,'role',p_role));
 return jsonb_build_object('exists',uid is not null,'confirmed',exists(select 1 from auth.users u where u.id=uid and to_jsonb(u)->>'email_confirmed_at' is not null));
end $$;
create function public.company_staff_active(p_company uuid,p_email text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$ declare i company_staff_invitations;uid uuid;b business_access;begin
 if company_role(p_company) is distinct from 'company_admin' or p_active is null then raise exception 'Forbidden';end if;
 select * into i from company_staff_invitations where company_id=p_company and email=lower(trim(p_email)) for update;
 if not found then raise exception 'Staff invitation unavailable';end if;
 select id into uid from auth.users u where lower(to_jsonb(u)->>'email')=i.email;
 if uid=auth.uid() or exists(select 1 from platform_admins where user_id=uid) then raise exception 'Owner access is protected';end if;
 if p_company='10000000-0000-4000-8000-000000000001' then
  select * into b from business_access where email=i.email;
  if found then perform business_set_access(i.email,b.role,b.principal_id,p_active);end if;
 end if;
 update platform_memberships set active=false where company_id=p_company and user_id=uid;
 if not p_active and i.role='delivery_driver' then update profiles set role='customer' where id=uid and role='driver';end if;
 update company_staff_invitations set active=p_active,claimed_at=null,claimed_user_id=null,updated_at=now() where company_id=p_company and email=i.email;
 perform platform_log(p_company,'company.staff.active',jsonb_build_object('email',i.email,'active',p_active));
end $$;
revoke all on function company_staff_active(uuid,text,boolean) from public,anon;
grant execute on function company_staff_active(uuid,text,boolean) to authenticated;
create function public.company_claim_staff() returns void language plpgsql security definer set search_path=public as $$ declare u jsonb;i company_staff_invitations;member_role text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select to_jsonb(x) into u from auth.users x where x.id=auth.uid();
 if u->>'email_confirmed_at' is null or coalesce((u->>'is_anonymous')::boolean,false) then return;end if;
 for i in select * from company_staff_invitations where email=lower(u->>'email') and active and claimed_at is null for update loop
  if not exists(select 1 from platform_companies where id=i.company_id and active) then continue;end if;
  member_role:=case i.role when 'van_sales' then 'field_agent' when 'delivery_driver' then 'field_agent' when 'supervisor' then 'supervisor' when 'company_admin' then 'company_admin' when 'it_manager' then 'company_admin' else 'customer' end;
  if member_role<>'customer' then
   insert into platform_memberships(company_id,user_id,role,label,active) values(i.company_id,auth.uid(),member_role,i.name,true)
   on conflict(company_id,user_id) do update set role=excluded.role,label=excluded.label,active=true;
  end if;
  if i.role='delivery_driver' then
   update profiles set role='driver' where id=auth.uid() and role in ('customer','driver');
   insert into drivers(id,user_id,name,phone) values('team-'||auth.uid()::text,auth.uid(),i.name,i.phone) on conflict(user_id) do update set name=excluded.name,phone=excluded.phone;
  end if;
  update profiles set name=i.name where id=auth.uid() and trim(name)='';
  update company_staff_invitations set claimed_user_id=auth.uid(),claimed_at=now() where company_id=i.company_id and email=i.email;
  perform platform_log(i.company_id,'company.staff.claimed',jsonb_build_object('role',i.role));
 end loop;
 perform business_claim_access();
end $$;
create function public.company_staff_email_result(p_company uuid,p_email text,p_error text default null) returns void language plpgsql security definer set search_path=public as $$ begin
 if company_role(p_company) is distinct from 'company_admin' then raise exception 'Forbidden';end if;
 update company_staff_invitations set last_email_at=case when p_error is null then now() else last_email_at end,last_email_error=left(p_error,300) where company_id=p_company and email=lower(trim(p_email));
end $$;
create function public.company_staff_directory(p_company uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
 if company_role(p_company) is distinct from 'company_admin' then raise exception 'Forbidden';end if;
 return jsonb_build_object('invitations',coalesce((select jsonb_agg(jsonb_build_object('email',email,'name',name,'phone',phone,'role',role,'principal_id',principal_id,'active',active,'claimed',claimed_at is not null,'last_email_at',last_email_at,'last_email_error',last_email_error) order by name) from company_staff_invitations where company_id=p_company),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(m.label,''),p.name),'email',to_jsonb(u)->>'email','role',m.role,'active',m.active) order by m.label) from platform_memberships m join profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id where m.company_id=p_company and m.role in ('company_admin','supervisor','field_agent')),'[]'::jsonb),
 'principals',coalesce((select jsonb_agg(to_jsonb(p)) from business_principals p where p_company='10000000-0000-4000-8000-000000000001'),'[]'::jsonb));
end $$;

revoke all on function field_store_directory(uuid,text,text,text,integer),field_save_outlet(uuid,uuid,text,text,text,text,double precision,double precision),field_set_route(uuid,text,uuid,boolean),field_route_plan(uuid),field_prepare_day(uuid),field_checkin(uuid,uuid,double precision,double precision,double precision,timestamptz),field_start_visit(uuid,uuid,double precision,double precision,double precision,timestamptz),field_propose_location(uuid,uuid,double precision,double precision,double precision,timestamptz),field_review_location(uuid,uuid,boolean),company_prepare_staff(uuid,text,text,text,text,text),company_claim_staff(),company_staff_email_result(uuid,text,text),company_staff_directory(uuid) from public,anon;
grant execute on function field_store_directory(uuid,text,text,text,integer),field_save_outlet(uuid,uuid,text,text,text,text,double precision,double precision),field_set_route(uuid,text,uuid,boolean),field_route_plan(uuid),field_prepare_day(uuid),field_checkin(uuid,uuid,double precision,double precision,double precision,timestamptz),field_start_visit(uuid,uuid,double precision,double precision,double precision,timestamptz),field_propose_location(uuid,uuid,double precision,double precision,double precision,timestamptz),field_review_location(uuid,uuid,boolean),company_prepare_staff(uuid,text,text,text,text,text),company_claim_staff(),company_staff_email_result(uuid,text,text),company_staff_directory(uuid) to authenticated;
