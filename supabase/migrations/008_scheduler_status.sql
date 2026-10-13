-- Admin-only inspection of the optional Supabase pg_cron deployment job.
create function public.reservation_scheduler_status() returns jsonb
language plpgsql stable security definer set search_path=public,pg_catalog as $$
declare result jsonb;
begin
  if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden'; end if;
  if to_regclass('cron.job') is null then return jsonb_build_object('active',false); end if;
  execute $query$
    select jsonb_build_object('active',j.active,'schedule',j.schedule,
      'last_status',d.status,'last_run',d.start_time)
    from cron.job j left join lateral
      (select status,start_time from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1) d on true
    where j.jobname='edgedirect2u-expire-reservations'
  $query$ into result;
  return coalesce(result,jsonb_build_object('active',false));
end $$;
revoke all on function public.reservation_scheduler_status() from public,anon;
grant execute on function public.reservation_scheduler_status() to authenticated;
