-- Physical business addresses are separate from workspace URLs and login identities.
alter table public.platform_companies add column address text not null default ''
  constraint company_address_length check (char_length(address) <= 500);

update public.platform_companies
set address = '15 Emmanuel Olorunfemi, off College Road, Ogba, Lagos, Nigeria'
where id = '10000000-0000-4000-8000-000000000001';

create function public.platform_set_company_address(p_company uuid, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not platform_is_admin() then
    raise exception 'Platform administrator with verified MFA required';
  end if;
  if p_address is null or char_length(trim(p_address)) > 500 then
    raise exception 'Company address must contain at most 500 characters';
  end if;
  update platform_companies set address = trim(p_address) where id = p_company;
  if not found then raise exception 'Company unavailable'; end if;
  perform platform_log(p_company, 'company.address', jsonb_build_object('field', 'address'));
end $$;
revoke all on function public.platform_set_company_address(uuid,text) from public,anon,authenticated;
grant execute on function public.platform_set_company_address(uuid,text) to authenticated;
