create table public.subscribers(owner_id uuid primary key references profiles(id),email text not null,status text not null check(status in ('subscribed','unsubscribed')),consent_version text not null,updated_at timestamptz not null default now());
create table public.subscriber_events(id uuid primary key default gen_random_uuid(),owner_id uuid not null references profiles(id),status text not null,consent_version text not null,created_at timestamptz not null default now());
alter table subscribers enable row level security;alter table subscriber_events enable row level security;
create policy subscriber_read on subscribers for select using(owner_id=auth.uid() or app_role()='admin');
create policy subscriber_events_read on subscriber_events for select using(owner_id=auth.uid() or app_role()='admin');
revoke all on subscribers,subscriber_events from public,anon,authenticated;
grant select on subscribers,subscriber_events to authenticated;
create function public.set_subscription(p_subscribe boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare email_address text;s text:=case when p_subscribe then 'subscribed' else 'unsubscribed' end;begin
 if auth.uid() is null or p_subscribe is null then raise exception 'Authentication required';end if;
 select lower(email) into email_address from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if email_address is null then raise exception 'Confirm your account email before changing subscriptions';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'-newsletter',0));
 if exists(select 1 from subscribers where owner_id=auth.uid() and status=s and email=email_address) then return jsonb_build_object('status',s);end if;
 insert into subscribers(owner_id,email,status,consent_version) values(auth.uid(),email_address,s,'newsletter-v1-2026-10-30')
 on conflict(owner_id) do update set email=excluded.email,status=excluded.status,consent_version=excluded.consent_version,updated_at=now();
 insert into subscriber_events(owner_id,status,consent_version) values(auth.uid(),s,'newsletter-v1-2026-10-30');
 return jsonb_build_object('status',s);
end $$;
revoke all on function set_subscription(boolean) from public,anon;
grant execute on function set_subscription(boolean) to authenticated;
