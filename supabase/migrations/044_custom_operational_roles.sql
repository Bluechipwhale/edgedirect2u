create function public.valid_commerce_permissions(p text[]) returns boolean language sql immutable as $$
 select coalesce(p is not null and cardinality(p) between 1 and 7 and p<@array['catalogue.read','catalogue.edit','inventory.read','inventory.adjust','support.manage','content.manage','reports.read'] and cardinality(p)=(select count(distinct x) from unnest(p) x) and(not('catalogue.edit'=any(p)) or 'catalogue.read'=any(p)) and(not('inventory.adjust'=any(p)) or 'inventory.read'=any(p)),false)
$$;
create table public.custom_commerce_roles(id uuid primary key,name text not null check(length(name) between 2 and 100),permissions text[] not null check(valid_commerce_permissions(permissions)),active boolean not null default true,updated_at timestamptz not null default now());
create table public.custom_commerce_assignments(user_id uuid primary key references profiles(id),role_id uuid not null references custom_commerce_roles(id),active boolean not null default true,updated_at timestamptz not null default now());
alter table custom_commerce_roles enable row level security;alter table custom_commerce_assignments enable row level security;
revoke all on custom_commerce_roles,custom_commerce_assignments from public,anon,authenticated;grant select on custom_commerce_roles,custom_commerce_assignments to authenticated;
create policy custom_assignment_read on custom_commerce_assignments for select using(user_id=auth.uid() or app_role()='admin');
create policy custom_role_read on custom_commerce_roles for select using(app_role()='admin' or exists(select 1 from custom_commerce_assignments a where a.role_id=id and a.user_id=auth.uid()));
create function public.commerce_can(p_permission text) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(auth.uid() is not null and p_permission=any(array['catalogue.read','catalogue.edit','inventory.read','inventory.adjust','support.manage','content.manage','reports.read']) and(
 app_role()='admin' or(app_role()='operations' and p_permission=any(array['inventory.read','inventory.adjust','support.manage'])) or(
 app_role()='customer' and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
 and not exists(select 1 from business_access where user_id=auth.uid() and active and role='client')
 and not exists(select 1 from platform_memberships where user_id=auth.uid() and active and(role='vendor' or company_id<>'10000000-0000-4000-8000-000000000001'))
 and exists(select 1 from custom_commerce_assignments a join custom_commerce_roles r on r.id=a.role_id where a.user_id=auth.uid() and a.active and r.active and p_permission=any(r.permissions)))),false)
$$;
create function public.commerce_context() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('name',case when app_role()='admin' then 'Administrator' when app_role()='operations' then 'Operations' else coalesce((select r.name from custom_commerce_assignments a join custom_commerce_roles r on r.id=a.role_id where a.user_id=auth.uid()),'Approved staff') end,'permissions',coalesce((select jsonb_agg(p) from unnest(array['catalogue.read','catalogue.edit','inventory.read','inventory.adjust','support.manage','content.manage','reports.read']) p where commerce_can(p)),'[]'))
$$;
create function public.save_commerce_role(p_id uuid,p_name text,p_permissions text[],p_active boolean) returns void language plpgsql security definer set search_path=public as $$begin
 if app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 if p_id is null or length(trim(coalesce(p_name,''))) not between 2 and 100 or valid_commerce_permissions(p_permissions) is distinct from true or p_active is null then raise exception 'Choose valid permissions; editing catalogue or adjusting inventory also requires its read permission';end if;
 insert into custom_commerce_roles(id,name,permissions,active) values(p_id,trim(p_name),p_permissions,p_active) on conflict(id) do update set name=excluded.name,permissions=excluded.permissions,active=excluded.active,updated_at=now();
 perform audit('permissions.role_saved',jsonb_build_object('id',p_id,'permissions',p_permissions,'active',p_active));
end $$;
create function public.assign_commerce_role(p_email text,p_role uuid,p_active boolean) returns void language plpgsql security definer set search_path=public as $$
declare target uuid;begin
 if app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 select id into target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
 if target is null then raise exception 'This staff member must register and confirm the exact email first';end if;
 if target=auth.uid() or exists(select 1 from platform_admins where user_id=target) or not exists(select 1 from profiles where id=target and role='customer') then raise exception 'Use predefined role management for administrators, operations, drivers or merchants. Owner access is protected.';end if;
 if p_active is null or not exists(select 1 from custom_commerce_roles where id=p_role) then raise exception 'Choose a custom role';end if;
 if p_active and(exists(select 1 from business_access where user_id=target and active and role='client') or exists(select 1 from platform_memberships where user_id=target and active and(role='vendor' or company_id<>'10000000-0000-4000-8000-000000000001'))) then raise exception 'Supplier clients and other-company members must retain scoped workspace access';end if;
 insert into custom_commerce_assignments(user_id,role_id,active) values(target,p_role,p_active) on conflict(user_id) do update set role_id=excluded.role_id,active=excluded.active,updated_at=now();
 perform audit('permissions.assignment_saved',jsonb_build_object('user',target,'role',p_role,'active',p_active));
end $$;
create function public.commerce_role_directory() returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 return jsonb_build_object('roles',coalesce((select jsonb_agg(to_jsonb(r) order by name,id) from custom_commerce_roles r),'[]'),'assignments',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('name',p.name,'email',u.email) order by a.user_id) from custom_commerce_assignments a join profiles p on p.id=a.user_id join auth.users u on u.id=a.user_id),'[]'));
end $$;
create policy delegated_product_read on products for select using(commerce_can('catalogue.read') or commerce_can('inventory.read'));
create policy delegated_gallery_read on gallery_media for select using(commerce_can('content.manage'));
create policy delegated_gallery_write on gallery_media for all using(commerce_can('content.manage')) with check(commerce_can('content.manage'));
create policy delegated_page_read on content_pages for select using(commerce_can('content.manage'));
create policy delegated_page_write on content_pages for all using(commerce_can('content.manage')) with check(commerce_can('content.manage'));
create policy delegated_asset_upload on storage.objects for insert to authenticated with check(bucket_id='brand-assets' and(commerce_can('catalogue.edit') or commerce_can('content.manage')));
create policy delegated_asset_register on branding_assets for insert to authenticated with check(owner_id=auth.uid() and(commerce_can('catalogue.edit') or commerce_can('content.manage')));
-- Replace only known authorization guards, preserving each workflow's checks,
-- locking, stock ledger, merchant isolation and audit behavior.
do $patch$
declare signature text;definition text;old text;replacement text;begin
 for signature,old,replacement in values
 ('inventory_catalogue(text,text,boolean,integer,integer)','not is_staff()','not commerce_can(''inventory.read'')'),
 ('set_reorder_level(text,integer)','not is_staff()','not commerce_can(''inventory.adjust'')'),
 ('adjust_stock(text,integer,text)','is_staff() or','commerce_can(''inventory.adjust'') or'),
 ('admin_product_catalogue(text,text,text,integer)','app_role()<>''admin''','commerce_can(''catalogue.read'') is distinct from true'),
 ('set_product_archived(text,boolean)','app_role()<>''admin''','commerce_can(''catalogue.edit'') is distinct from true'),
 ('admin_report_dataset(text,date,date,integer,integer)','app_role() is distinct from ''admin''','commerce_can(''reports.read'') is distinct from true'),
 ('can_read_support(uuid)','app_role() in (''admin'',''operations'')','commerce_can(''support.manage'')'),
 ('reply_support(uuid,uuid,text,text)','app_role() in (''admin'',''operations'')','commerce_can(''support.manage'')'),
 ('save_product(text,jsonb)','elsif app_role()<>''admin'' then raise exception ''Forbidden'';end if;','elsif commerce_can(''catalogue.edit'') is distinct from true then raise exception ''Forbidden'';elsif app_role()<>''admin'' and ((existing.id is null and owner is distinct from ''edge'') or(existing.id is not null and owner is distinct from existing.merchant_id)) then raise exception ''Only an administrator can change product ownership; new delegated products belong in-house'';end if;')
 loop
  definition:=pg_get_functiondef(to_regprocedure('public.'||signature));
  if definition is null or(length(definition)-length(replace(definition,old,'')))/length(old)<>1 then raise exception 'Unexpected function guard for %. No permission changes applied.',signature;end if;
  execute replace(definition,old,replacement);
 end loop;
end $patch$;
revoke all on function valid_commerce_permissions(text[]) from public,anon,authenticated;
revoke all on function commerce_can(text),commerce_context(),save_commerce_role(uuid,text,text[],boolean),assign_commerce_role(text,uuid,boolean),commerce_role_directory() from public,anon;
grant execute on function commerce_can(text) to anon,authenticated;
grant execute on function commerce_context(),save_commerce_role(uuid,text,text[],boolean),assign_commerce_role(text,uuid,boolean),commerce_role_directory() to authenticated;
