-- Workspace discovery and bounded schedules, with company-scoped aggregate reports.
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

create function public.field_schedule(p_company uuid) returns setof field_assignments language sql stable security invoker set search_path=public as $$
select * from field_assignments where company_id=p_company and visit_date between (now() at time zone 'Africa/Lagos')::date-7 and (now() at time zone 'Africa/Lagos')::date+14
order by (visit_date=(now() at time zone 'Africa/Lagos')::date) desc,visit_date desc,created_at desc limit 200 $$;
revoke all on function field_schedule(uuid) from public,anon;
grant execute on function field_schedule(uuid) to authenticated;
