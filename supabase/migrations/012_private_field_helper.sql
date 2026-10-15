-- Field entitlement checks are internal to the authorized security-definer RPCs.
-- Company members read their own modules through RLS, not this unscoped helper.
revoke all on function public.field_enabled(uuid) from authenticated;
