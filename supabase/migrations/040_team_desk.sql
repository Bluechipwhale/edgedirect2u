-- Company-scoped schedules, emergency records and in-app conversations.
create table public.team_schedules(id uuid primary key,company_id uuid not null,agent_id uuid not null,label text not null check(length(label) between 2 and 100),starts_at timestamptz not null,ends_at timestamptz not null,notes text not null default '' check(length(notes)<=500),active boolean not null default true,created_by uuid not null references profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(company_id,agent_id) references platform_memberships(company_id,user_id),check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'));
create table public.team_emergency_contacts(company_id uuid not null,agent_id uuid not null,name text not null check(length(name) between 2 and 100),relationship text not null check(length(relationship) between 2 and 80),phone text not null check(phone ~ '^\+?[0-9 ()-]{10,25}$'),updated_at timestamptz not null default now(),updated_by uuid not null references profiles(id),primary key(company_id,agent_id),foreign key(company_id,agent_id) references platform_memberships(company_id,user_id));
create table public.team_messages(id uuid primary key,company_id uuid not null,agent_id uuid not null,author_id uuid not null references profiles(id),from_manager boolean not null,body text not null check(length(body) between 1 and 4000),created_at timestamptz not null default now(),foreign key(company_id,agent_id) references platform_memberships(company_id,user_id));
create index team_schedule_window_idx on team_schedules(company_id,agent_id,starts_at,id);
create index team_message_thread_idx on team_messages(company_id,agent_id,created_at desc,id);
create function public.team_can_read(p_company uuid,p_agent uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(auth.uid() is not null and field_enabled(p_company) and (company_role(p_company) in ('company_admin','supervisor') or (company_role(p_company)='field_agent' and p_agent=auth.uid())) and exists(select 1 from platform_memberships where company_id=p_company and user_id=p_agent),false)
$$;
do $$declare t text;begin foreach t in array array['team_schedules','team_emergency_contacts','team_messages'] loop
 execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);execute format('grant select on %I to authenticated',t);execute format('create policy team_scoped_read on %I for select using(team_can_read(company_id,agent_id))',t);
end loop;end $$;
create function public.team_desk_agents(p_company uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if auth.uid() is null or not field_enabled(p_company) or coalesce(company_role(p_company),'') not in ('company_admin','supervisor','field_agent') then raise exception 'Forbidden';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'label',coalesce(nullif(m.label,''),nullif(p.name,''),m.user_id::text),'active',m.active) order by m.active desc,m.label,m.user_id) from platform_memberships m join profiles p on p.id=m.user_id where m.company_id=p_company and m.role='field_agent' and (company_role(p_company) in ('company_admin','supervisor') or m.user_id=auth.uid())),'[]');
end $$;
create function public.save_team_contact(p_company uuid,p_agent uuid,p_name text,p_relationship text,p_phone text) returns void language plpgsql security definer set search_path=public as $$begin
 if team_can_read(p_company,p_agent) is distinct from true then raise exception 'Forbidden';end if;
 if not exists(select 1 from platform_memberships where company_id=p_company and user_id=p_agent and active and role='field_agent') then raise exception 'Select an active field or delivery team member';end if;
 insert into team_emergency_contacts(company_id,agent_id,name,relationship,phone,updated_by) values(p_company,p_agent,trim(p_name),trim(p_relationship),trim(p_phone),auth.uid())
 on conflict(company_id,agent_id) do update set name=excluded.name,relationship=excluded.relationship,phone=excluded.phone,updated_by=excluded.updated_by,updated_at=now();
 perform platform_log(p_company,'team.emergency_contact_saved',jsonb_build_object('agent',p_agent));
end $$;
create function public.save_team_schedule(p_id uuid,p_company uuid,p_agent uuid,p_label text,p_start timestamptz,p_end timestamptz,p_notes text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
declare prior team_schedules;begin
 if auth.uid() is null or not field_enabled(p_company) or coalesce(company_role(p_company),'') not in ('company_admin','supervisor') then raise exception 'Forbidden';end if;
 if p_id is null or p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '24 hours' or p_active is null then raise exception 'Choose a schedule of up to 24 hours';end if;
 if not exists(select 1 from platform_memberships where company_id=p_company and user_id=p_agent and active and role='field_agent') then raise exception 'Select an active field or delivery team member';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_company::text||p_agent::text||'-schedule',0));
 select * into prior from team_schedules where id=p_id for update;
 if found and (prior.company_id<>p_company or prior.agent_id<>p_agent) then raise exception 'Forbidden';end if;
 if p_active and exists(select 1 from team_schedules where company_id=p_company and agent_id=p_agent and active and id<>p_id and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'This team member already has an overlapping active schedule';end if;
 insert into team_schedules(id,company_id,agent_id,label,starts_at,ends_at,notes,active,created_by) values(p_id,p_company,p_agent,trim(p_label),p_start,p_end,coalesce(p_notes,''),p_active,auth.uid())
 on conflict(id) do update set label=excluded.label,starts_at=excluded.starts_at,ends_at=excluded.ends_at,notes=excluded.notes,active=excluded.active,updated_at=now();
 perform platform_log(p_company,'team.schedule_saved',jsonb_build_object('schedule',p_id,'agent',p_agent,'active',p_active));
end $$;
create function public.send_team_message(p_id uuid,p_company uuid,p_agent uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare prior team_messages;begin
 if team_can_read(p_company,p_agent) is distinct from true then raise exception 'Forbidden';end if;
 if not exists(select 1 from platform_memberships where company_id=p_company and user_id=p_agent and active and role='field_agent') then raise exception 'Team member is inactive';end if;
 if p_id is null or length(trim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'Write a message of 1–4000 characters';end if;
 select * into prior from team_messages where id=p_id;if found then
  if prior.company_id=p_company and prior.agent_id=p_agent and prior.author_id=auth.uid() and prior.body=trim(p_body) then return;end if;raise exception 'Message ID already used';
 end if;
 if exists(select 1 from team_messages where author_id=auth.uid() and created_at>now()-interval '3 seconds') then raise exception 'Please wait a few seconds before sending another message';end if;
 insert into team_messages values(p_id,p_company,p_agent,auth.uid(),company_role(p_company) in ('company_admin','supervisor'),trim(p_body),now());
end $$;
create function public.team_desk_snapshot(p_company uuid,p_agent uuid,p_from date,p_to date,p_message_page integer default 1,p_schedule_page integer default 1,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;start_at timestamptz:=p_from::timestamp at time zone 'Africa/Lagos';end_at timestamptz:=(p_to+1)::timestamp at time zone 'Africa/Lagos';begin
 if team_can_read(p_company,p_agent) is distinct from true then raise exception 'Forbidden';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_message_page is null or p_message_page not between 1 and 100000 or p_schedule_page is null or p_schedule_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid period or page';end if;
 select jsonb_build_object('contact',(select to_jsonb(c) from team_emergency_contacts c where company_id=p_company and agent_id=p_agent),
 'message_count',(select count(*) from team_messages where company_id=p_company and agent_id=p_agent),
 'messages',coalesce((select jsonb_agg(to_jsonb(msg) order by msg.created_at desc,msg.id) from(select * from team_messages where company_id=p_company and agent_id=p_agent order by created_at desc,id limit p_limit offset (p_message_page-1)*p_limit) msg),'[]'),
 'schedule_count',(select count(*) from team_schedules where company_id=p_company and agent_id=p_agent and ends_at>start_at and starts_at<end_at),
 'schedules',coalesce((select jsonb_agg(to_jsonb(sch) order by sch.starts_at,sch.id) from(select * from team_schedules where company_id=p_company and agent_id=p_agent and ends_at>start_at and starts_at<end_at order by starts_at,id limit p_limit offset (p_schedule_page-1)*p_limit) sch),'[]')) into result;return result;
end $$;
revoke all on function team_can_read(uuid,uuid),team_desk_agents(uuid),save_team_contact(uuid,uuid,text,text,text),save_team_schedule(uuid,uuid,uuid,text,timestamptz,timestamptz,text,boolean),send_team_message(uuid,uuid,uuid,text),team_desk_snapshot(uuid,uuid,date,date,integer,integer,integer) from public,anon;
grant execute on function team_can_read(uuid,uuid),team_desk_agents(uuid),save_team_contact(uuid,uuid,text,text,text),save_team_schedule(uuid,uuid,uuid,text,timestamptz,timestamptz,text,boolean),send_team_message(uuid,uuid,uuid,text),team_desk_snapshot(uuid,uuid,date,date,integer,integer,integer) to authenticated;
