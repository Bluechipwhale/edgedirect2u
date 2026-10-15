-- Additive company kernel. Existing commerce remains flagship-only until its own tenant migration.
create table public.platform_companies (
  id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60),
  name text not null check(length(name) between 2 and 100), active boolean not null default true,
  package text not null default 'field_operations' check(package in ('commerce','delivery','field_operations','enterprise')),
  brand jsonb not null default '{}', brand_draft jsonb not null default '{}',
  geofence_metres integer not null default 100 check(geofence_metres between 25 and 1000), daily_target integer not null default 30 check(daily_target between 1 and 200),
  allow_web_checkin boolean not null default false, created_at timestamptz not null default now()
);
create table public.platform_memberships (
  company_id uuid not null references platform_companies(id), user_id uuid not null references profiles(id),
  role text not null check(role in ('company_admin','supervisor','field_agent','vendor','customer')), active boolean not null default true, label text not null default '',
  primary key(company_id,user_id)
);
create table public.platform_admins(user_id uuid primary key references profiles(id),active boolean not null default true,created_at timestamptz not null default now());
create table public.platform_modules(company_id uuid references platform_companies(id),module text check(module in ('branding','field_operations','commerce','delivery')),enabled boolean not null default false,primary key(company_id,module),check(not enabled or module in ('branding','field_operations')));
create table public.platform_domains(host text primary key check(host ~ '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$'),company_id uuid not null references platform_companies(id),verified boolean not null default false);
create table public.platform_audit(id uuid primary key default gen_random_uuid(),company_id uuid references platform_companies(id),actor uuid references profiles(id),action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now());
create table public.platform_brand_versions(company_id uuid references platform_companies(id),id uuid not null default gen_random_uuid(),config jsonb not null,actor uuid references profiles(id),created_at timestamptz not null default now(),primary key(company_id,id));
create table public.field_stores(company_id uuid references platform_companies(id),id uuid not null default gen_random_uuid(),name text not null check(length(name) between 2 and 100),address text not null check(length(address) between 5 and 500),latitude double precision not null check(latitude between -90 and 90),longitude double precision not null check(longitude between -180 and 180),radius_metres integer check(radius_metres between 25 and 1000),active boolean not null default true,created_at timestamptz not null default now(),primary key(company_id,id));
create table public.field_assignments(company_id uuid not null,id uuid not null default gen_random_uuid(),store_id uuid not null,agent_id uuid not null,visit_date date not null,created_at timestamptz not null default now(),primary key(company_id,id),foreign key(company_id,store_id) references field_stores(company_id,id),foreign key(company_id,agent_id) references platform_memberships(company_id,user_id),unique(company_id,store_id,agent_id,visit_date));
create table public.field_shifts(company_id uuid not null,id uuid not null default gen_random_uuid(),agent_id uuid not null,started_at timestamptz not null default now(),ended_at timestamptz,primary key(company_id,id),foreign key(company_id,agent_id) references platform_memberships(company_id,user_id));
create unique index field_one_open_shift on field_shifts(company_id,agent_id) where ended_at is null;
create table public.field_visits(company_id uuid not null,id uuid not null default gen_random_uuid(),assignment_id uuid not null,agent_id uuid not null,started_at timestamptz not null default now(),completed_at timestamptz,latitude double precision,longitude double precision,accuracy_metres double precision,captured_at timestamptz,distance_metres double precision,override_reason text,task_report jsonb,primary key(company_id,id),foreign key(company_id,assignment_id) references field_assignments(company_id,id),foreign key(company_id,agent_id) references platform_memberships(company_id,user_id),unique(company_id,assignment_id));
create index field_agent_schedule on field_assignments(company_id,agent_id,visit_date);
create index field_visit_history on field_visits(company_id,agent_id,started_at desc);
create unique index field_one_open_visit on field_visits(company_id,agent_id) where completed_at is null;

create function public.platform_is_admin() returns boolean language sql stable security definer set search_path=public as $$
select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','')='aal2' and exists(select 1 from platform_admins where user_id=auth.uid() and active) $$;
create function public.company_role(p_company uuid) returns text language sql stable security definer set search_path=public as $$
select m.role from platform_memberships m join platform_companies c on c.id=m.company_id where m.company_id=p_company and m.user_id=auth.uid() and m.active and c.active $$;
create function public.field_enabled(p_company uuid) returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from platform_modules where company_id=p_company and module='field_operations' and enabled) $$;
create function public.platform_log(p_company uuid,p_action text,p_detail jsonb default '{}') returns void language sql security definer set search_path=public as $$ insert into platform_audit(company_id,actor,action,detail) values(p_company,auth.uid(),p_action,p_detail) $$;
revoke all on function platform_log(uuid,text,jsonb) from public,anon,authenticated;

alter table platform_companies enable row level security;
create policy company_read on platform_companies for select using(company_role(id) in ('company_admin','supervisor') or platform_is_admin());
alter table platform_memberships enable row level security;
create policy company_member_read on platform_memberships for select using(company_role(company_id) in ('company_admin','supervisor') or (user_id=auth.uid() and company_role(company_id) is not null));
alter table platform_admins enable row level security;
create policy platform_self_read on platform_admins for select using(user_id=auth.uid());
alter table platform_modules enable row level security;
create policy module_read on platform_modules for select using(company_role(company_id) is not null or platform_is_admin());
alter table platform_domains enable row level security;
create policy domain_read on platform_domains for select using(company_role(company_id)='company_admin' or platform_is_admin());
alter table platform_audit enable row level security;
create policy platform_audit_read on platform_audit for select using(platform_is_admin() or company_role(company_id)='company_admin');
alter table platform_brand_versions enable row level security;
create policy brand_version_read on platform_brand_versions for select using(company_role(company_id)='company_admin');
alter table field_stores enable row level security;
create policy field_store_read on field_stores for select using(company_role(company_id) in ('company_admin','supervisor') or (company_role(company_id)='field_agent' and exists(select 1 from field_assignments a where a.company_id=field_stores.company_id and a.store_id=field_stores.id and a.agent_id=auth.uid())));
alter table field_assignments enable row level security;
create policy field_assignment_read on field_assignments for select using(company_role(company_id) in ('company_admin','supervisor') or (agent_id=auth.uid() and company_role(company_id)='field_agent'));
alter table field_shifts enable row level security;
create policy field_shift_read on field_shifts for select using(company_role(company_id) in ('company_admin','supervisor') or (agent_id=auth.uid() and company_role(company_id)='field_agent'));
alter table field_visits enable row level security;
create policy field_visit_read on field_visits for select using(company_role(company_id) in ('company_admin','supervisor') or (agent_id=auth.uid() and company_role(company_id)='field_agent'));
create function public.company_context(p_slug text) returns jsonb language plpgsql stable security definer set search_path=public as $$ declare c platform_companies;r text;begin
select * into c from platform_companies where slug=p_slug and active;if not found then raise exception 'Company unavailable';end if;r=company_role(c.id);
if coalesce(r,'') not in ('company_admin','supervisor','field_agent') then raise exception 'Company membership required';end if;
if r='company_admin' then return to_jsonb(c);else return to_jsonb(c)-'brand_draft';end if;end $$;
revoke all on function company_context(text) from public,anon;grant execute on function company_context(text) to authenticated;
-- Explicitly remove Supabase default table privileges before granting read access.
revoke all on platform_companies,platform_memberships,platform_admins,platform_modules,platform_domains,platform_audit,platform_brand_versions,field_stores,field_assignments,field_shifts,field_visits from public,anon,authenticated;
grant select on platform_companies,platform_memberships,platform_admins,platform_modules,platform_domains,platform_audit,platform_brand_versions,field_stores,field_assignments,field_shifts,field_visits to authenticated;

insert into platform_companies(id,slug,name,brand,brand_draft) select '10000000-0000-4000-8000-000000000001','e-edge-direct-2u','E-Edge Direct 2U',config,config from website_settings where id='published';
insert into platform_modules(company_id,module,enabled) select id,m,true from platform_companies cross join unnest(array['branding','field_operations']) m;
create function public.sync_flagship_membership() returns trigger language plpgsql security definer set search_path=public as $$ begin
if exists(select 1 from platform_companies where id='10000000-0000-4000-8000-000000000001') then
insert into platform_memberships(company_id,user_id,role) values('10000000-0000-4000-8000-000000000001',new.id,case new.role when 'admin' then 'company_admin' when 'operations' then 'supervisor' when 'driver' then 'field_agent' when 'merchant' then 'vendor' else 'customer' end) on conflict(company_id,user_id) do update set role=excluded.role;
end if;return new;end $$;
create trigger flagship_profile_membership after insert or update of role on profiles for each row execute function sync_flagship_membership();
insert into platform_memberships(company_id,user_id,role) select '10000000-0000-4000-8000-000000000001',p.id,case p.role when 'admin' then 'company_admin' when 'operations' then 'supervisor' when 'driver' then 'field_agent' when 'merchant' then 'vendor' else 'customer' end from profiles p where exists(select 1 from platform_companies where id='10000000-0000-4000-8000-000000000001');

create function public.platform_create_company(p_slug text,p_name text,p_owner_email text,p_package text,p_brand jsonb) returns uuid language plpgsql security definer set search_path=public as $$ declare cid uuid;owner_id uuid;begin
if not platform_is_admin() then raise exception 'Platform administrator with verified MFA required';end if;
if not coalesce(valid_theme(p_brand),false) then raise exception 'Invalid brand configuration';end if;
select id into owner_id from auth.users where lower(email)=lower(trim(p_owner_email)) and email_confirmed_at is not null;if not found then raise exception 'Company owner must have a confirmed account';end if;
insert into platform_companies(slug,name,package,brand,brand_draft) values(p_slug,p_name,p_package,p_brand,p_brand) returning id into cid;
insert into platform_memberships(company_id,user_id,role,label) values(cid,owner_id,'company_admin',lower(trim(p_owner_email)));
insert into platform_modules(company_id,module,enabled) values(cid,'branding',true),(cid,'field_operations',p_package in ('field_operations','enterprise')),(cid,'commerce',false),(cid,'delivery',false);
perform platform_log(cid,'company.created',jsonb_build_object('slug',p_slug,'package',p_package));return cid;end $$;
create function public.platform_set_active(p_company uuid,p_active boolean) returns void language plpgsql security definer set search_path=public as $$ begin
if not platform_is_admin() then raise exception 'Platform administrator with verified MFA required';end if;
if p_company='10000000-0000-4000-8000-000000000001' then raise exception 'Flagship commerce suspension requires the commerce tenant cutover';end if;
update platform_companies set active=p_active where id=p_company;if not found then raise exception 'Company unavailable';end if;
perform platform_log(p_company,'company.activation',jsonb_build_object('active',p_active));end $$;
create function public.company_set_member(p_company uuid,p_email text,p_role text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$ declare member_id uuid;begin
if company_role(p_company) is distinct from 'company_admin' then raise exception 'Forbidden';end if;
if p_role not in ('company_admin','supervisor','field_agent','vendor','customer') then raise exception 'Invalid company role';end if;
select id into member_id from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;if not found then raise exception 'Member must have a confirmed account';end if;
if member_id=auth.uid() then raise exception 'Self role changes are not permitted';end if;
insert into platform_memberships(company_id,user_id,role,active,label) values(p_company,member_id,p_role,p_active,lower(trim(p_email))) on conflict(company_id,user_id) do update set role=excluded.role,active=excluded.active,label=excluded.label;
perform platform_log(p_company,'company.member',jsonb_build_object('user',member_id,'role',p_role,'active',p_active));end $$;
-- Keep the flagship's existing Theme Studio and the new company workspace in sync.
create function public.sync_flagship_brand() returns trigger language plpgsql security definer set search_path=public as $$ begin
if new.id='published' then update platform_companies set brand=new.config where id='10000000-0000-4000-8000-000000000001';
elsif new.id='draft' then update platform_companies set brand_draft=new.config where id='10000000-0000-4000-8000-000000000001';end if;return new;end $$;
revoke all on function sync_flagship_brand() from public,anon,authenticated;
create trigger flagship_brand_sync after insert or update of config on website_settings for each row execute function sync_flagship_brand();
create function public.company_brand(p_company uuid,p_action text,p_config jsonb,p_version uuid default null) returns void language plpgsql security definer set search_path=public as $$ declare c platform_companies;t jsonb;vid uuid;begin
if company_role(p_company) is distinct from 'company_admin' then raise exception 'Forbidden';end if;
if p_company='10000000-0000-4000-8000-000000000001' then perform pg_advisory_xact_lock(hashtextextended('global-theme',0));end if;
select * into c from platform_companies where id=p_company for update;
if p_action='rollback' then select config into t from platform_brand_versions where company_id=p_company and id=p_version;if not found then raise exception 'Brand version unavailable';end if;
elsif p_action in ('draft','publish') then t=p_config;else raise exception 'Invalid brand action';end if;
if not coalesce(valid_theme(t),false) then raise exception 'Invalid brand configuration';end if;
if p_action='draft' then update platform_companies set brand_draft=t where id=p_company;
else insert into platform_brand_versions(company_id,config,actor) values(p_company,c.brand,auth.uid());update platform_companies set brand=t,brand_draft=t where id=p_company;end if;
if p_company='10000000-0000-4000-8000-000000000001' then
update website_settings set config=t,updated_at=now() where id='draft';
if p_action<>'draft' then insert into theme_versions(config,created_by) values(t,auth.uid()) returning id into vid;update website_settings set config=t,version_id=vid,updated_at=now() where id='published';end if;
end if;
perform platform_log(p_company,'company.brand.'||p_action);end $$;
create function public.company_field_policy(p_company uuid,p_radius integer,p_target integer,p_web boolean) returns void language plpgsql security definer set search_path=public as $$ begin
if company_role(p_company) is distinct from 'company_admin' then raise exception 'Forbidden';end if;
update platform_companies set geofence_metres=p_radius,daily_target=p_target,allow_web_checkin=p_web where id=p_company;
perform platform_log(p_company,'company.field_policy',jsonb_build_object('radius',p_radius,'target',p_target,'web',p_web));end $$;

create function public.field_save_store(p_company uuid,p_name text,p_address text,p_lat double precision,p_lng double precision,p_radius integer) returns uuid language plpgsql security definer set search_path=public as $$ declare sid uuid;begin
if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
insert into field_stores(company_id,name,address,latitude,longitude,radius_metres) values(p_company,p_name,p_address,p_lat,p_lng,p_radius) returning id into sid;
perform platform_log(p_company,'field.store.created',jsonb_build_object('store',sid));return sid;end $$;
create function public.field_assign(p_company uuid,p_store uuid,p_agent uuid,p_date date) returns uuid language plpgsql security definer set search_path=public as $$ declare aid uuid;begin
if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
if not exists(select 1 from platform_memberships where company_id=p_company and user_id=p_agent and role='field_agent' and active) then raise exception 'Select an active company field agent';end if;
if not exists(select 1 from field_stores where company_id=p_company and id=p_store and active) then raise exception 'Store unavailable';end if;
insert into field_assignments(company_id,store_id,agent_id,visit_date) values(p_company,p_store,p_agent,p_date) on conflict(company_id,store_id,agent_id,visit_date) do update set visit_date=excluded.visit_date returning id into aid;
perform platform_log(p_company,'field.assigned',jsonb_build_object('assignment',aid,'agent',p_agent));return aid;end $$;
create function public.field_shift(p_company uuid,p_action text) returns void language plpgsql security definer set search_path=public as $$ begin
if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then raise exception 'Forbidden';end if;
perform 1 from field_shifts where company_id=p_company and agent_id=auth.uid() and ended_at is null for update;
if p_action='in' then insert into field_shifts(company_id,agent_id) values(p_company,auth.uid()) on conflict(company_id,agent_id) where ended_at is null do nothing;
elsif p_action='out' then
if exists(select 1 from field_visits where company_id=p_company and agent_id=auth.uid() and completed_at is null) then raise exception 'Complete the open visit before clocking out';end if;
update field_shifts set ended_at=now() where company_id=p_company and agent_id=auth.uid() and ended_at is null;
else raise exception 'Invalid shift action';end if;perform platform_log(p_company,'field.shift.'||p_action);end $$;
create function public.field_distance(p_lat double precision,p_lng double precision,p_store_lat double precision,p_store_lng double precision) returns double precision language sql immutable as $$ select 6371000.0*2*asin(least(1.0,sqrt(power(sin(radians(p_store_lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(p_store_lat))*power(sin(radians(p_store_lng-p_lng)/2),2)))) $$;
create function public.field_checkin(p_company uuid,p_assignment uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_captured timestamptz) returns uuid language plpgsql security definer set search_path=public as $$ declare c platform_companies;s field_stores;a field_assignments;vid uuid;distance double precision;begin
if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then raise exception 'Forbidden';end if;
select * into c from platform_companies where id=p_company;
-- Until an attested native protocol ships, every available API caller is subject to the web policy.
if not c.allow_web_checkin then raise exception 'Web check-in is disabled by company policy';end if;
perform 1 from field_shifts where company_id=p_company and agent_id=auth.uid() and ended_at is null for update;if not found then raise exception 'Clock in before visiting a store';end if;
select * into a from field_assignments where company_id=p_company and id=p_assignment and agent_id=auth.uid() and visit_date=(now() at time zone 'Africa/Lagos')::date for update;
if not found then raise exception 'Assigned store unavailable for today';end if;
select id into vid from field_visits where company_id=p_company and assignment_id=p_assignment;if found then return vid;end if;
if exists(select 1 from field_visits where company_id=p_company and agent_id=auth.uid() and completed_at is null) then raise exception 'Complete the open visit first';end if;
if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 or p_accuracy is null or p_accuracy not between 0 and 50 or p_captured is null or p_captured<now()-interval '60 seconds' or p_captured>now()+interval '5 seconds' then raise exception 'Fresh location with accuracy of 50 metres or better is required';end if;
select * into s from field_stores where company_id=p_company and id=a.store_id and active;if not found then raise exception 'Store unavailable';end if;
distance=field_distance(p_lat,p_lng,s.latitude,s.longitude);
if distance+p_accuracy>coalesce(s.radius_metres,c.geofence_metres) then raise exception 'Location uncertainty extends outside the store geofence';end if;
insert into field_visits(company_id,assignment_id,agent_id,latitude,longitude,accuracy_metres,captured_at,distance_metres) values(p_company,p_assignment,auth.uid(),p_lat,p_lng,p_accuracy,p_captured,distance) returning id into vid;
perform platform_log(p_company,'field.checkin',jsonb_build_object('visit',vid));return vid;end $$;
create function public.field_override(p_company uuid,p_assignment uuid,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$ declare a field_assignments;vid uuid;begin
if coalesce(company_role(p_company),'') not in ('company_admin','supervisor') or not field_enabled(p_company) then raise exception 'Forbidden';end if;
if coalesce(length(trim(p_reason)),0) not between 15 and 500 then raise exception 'Give an override justification of 15 to 500 characters';end if;
select * into a from field_assignments where company_id=p_company and id=p_assignment and visit_date=(now() at time zone 'Africa/Lagos')::date for update;if not found then raise exception 'Assignment unavailable for today';end if;
perform 1 from field_shifts where company_id=p_company and agent_id=a.agent_id and ended_at is null for update;if not found then raise exception 'Agent must be on shift';end if;
if exists(select 1 from field_visits where company_id=p_company and agent_id=a.agent_id and completed_at is null) then raise exception 'Agent already has an open visit';end if;
insert into field_visits(company_id,assignment_id,agent_id,override_reason) values(p_company,p_assignment,a.agent_id,trim(p_reason)) returning id into vid;
perform platform_log(p_company,'field.supervisor_override',jsonb_build_object('visit',vid,'reason',trim(p_reason)));return vid;end $$;
create function public.field_complete(p_company uuid,p_visit uuid,p_report jsonb) returns void language plpgsql security definer set search_path=public as $$ declare v field_visits;begin
if company_role(p_company) is distinct from 'field_agent' or not field_enabled(p_company) then raise exception 'Forbidden';end if;
select * into v from field_visits where company_id=p_company and id=p_visit and agent_id=auth.uid() for update;if not found then raise exception 'Visit unavailable';end if;
if v.completed_at is not null then if v.task_report=p_report then return;else raise exception 'Completed report is immutable';end if;end if;
if jsonb_typeof(p_report) is distinct from 'object' or p_report->'stock_checked' is distinct from 'true'::jsonb or p_report->'contact_confirmed' is distinct from 'true'::jsonb or jsonb_typeof(p_report->'notes') is distinct from 'string' or coalesce(length(trim(p_report->>'notes')),0) not between 10 and 2000 or octet_length(p_report::text)>4096 then raise exception 'Complete stock check, contact confirmation and visit notes';end if;
update field_visits set completed_at=now(),task_report=p_report where company_id=p_company and id=p_visit;
perform platform_log(p_company,'field.completed',jsonb_build_object('visit',p_visit));end $$;

revoke all on function platform_is_admin(),company_role(uuid),field_enabled(uuid),sync_flagship_membership(),platform_create_company(text,text,text,text,jsonb),platform_set_active(uuid,boolean),company_set_member(uuid,text,text,boolean),company_brand(uuid,text,jsonb,uuid),company_field_policy(uuid,integer,integer,boolean),field_save_store(uuid,text,text,double precision,double precision,integer),field_assign(uuid,uuid,uuid,date),field_shift(uuid,text),field_distance(double precision,double precision,double precision,double precision),field_checkin(uuid,uuid,double precision,double precision,double precision,timestamptz),field_override(uuid,uuid,text),field_complete(uuid,uuid,jsonb) from public,anon;
grant execute on function platform_is_admin(),company_role(uuid),field_enabled(uuid),platform_create_company(text,text,text,text,jsonb),platform_set_active(uuid,boolean),company_set_member(uuid,text,text,boolean),company_brand(uuid,text,jsonb,uuid),company_field_policy(uuid,integer,integer,boolean),field_save_store(uuid,text,text,double precision,double precision,integer),field_assign(uuid,uuid,uuid,date),field_shift(uuid,text),field_checkin(uuid,uuid,double precision,double precision,double precision,timestamptz),field_override(uuid,uuid,text),field_complete(uuid,uuid,jsonb) to authenticated;

-- Keep operational evidence but expire precise location data after 90 days.
create function public.field_purge_location() returns bigint language plpgsql security definer set search_path=public as $$ declare removed bigint;begin
update field_visits set latitude=null,longitude=null,accuracy_metres=null,captured_at=null,distance_metres=null where completed_at<now()-interval '90 days' and latitude is not null;
get diagnostics removed=row_count;return removed;end $$;
revoke all on function field_purge_location() from public,anon,authenticated;
grant execute on function field_purge_location() to service_role;

create function public.my_company_workspaces() returns table(slug text,name text,role text) language sql stable security definer set search_path=public as $$
select c.slug,c.name,m.role from platform_memberships m join platform_companies c on c.id=m.company_id where m.user_id=auth.uid() and m.active and c.active and m.role in ('company_admin','supervisor','field_agent') order by c.name $$;
revoke all on function my_company_workspaces() from public,anon;
grant execute on function my_company_workspaces() to authenticated;

-- Invoker rights preserve the same row policies as every underlying workspace list.
create function public.company_metrics(p_company uuid) returns jsonb language plpgsql stable security invoker set search_path=public as $$ begin
if coalesce(company_role(p_company),'') not in ('company_admin','supervisor','field_agent') then raise exception 'Forbidden';end if;
return jsonb_build_object(
'stores',(select count(*) from field_stores where company_id=p_company and active),
'planned',(select count(*) from field_assignments where company_id=p_company and visit_date=(now() at time zone 'Africa/Lagos')::date),
'completed',(select count(*) from field_visits where company_id=p_company and (completed_at at time zone 'Africa/Lagos')::date=(now() at time zone 'Africa/Lagos')::date),
'agents',(select count(*) from platform_memberships where company_id=p_company and active and role='field_agent'));
end $$;
revoke all on function company_metrics(uuid) from public,anon;
grant execute on function company_metrics(uuid) to authenticated;
