-- Keep the transactional implementation private; all callers enter through the
-- registered-account guard, including direct PostgREST RPC requests.
alter function public.create_checkout(jsonb) rename to create_checkout_reserved;
revoke all on function public.create_checkout_reserved(jsonb) from public,anon,authenticated;

create function public.create_checkout(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or coalesce(
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'is_anonymous',
    'false'
  ) = 'true' then
    raise exception 'Authentication required';
  end if;
  return create_checkout_reserved(p_input);
end $$;
revoke all on function public.create_checkout(jsonb) from public,anon,authenticated;
grant execute on function public.create_checkout(jsonb) to authenticated;
