create table public.support_tickets(
 id uuid primary key default gen_random_uuid(),owner_id uuid references profiles(id),name text not null,email text not null,
 subject text not null check(length(subject) between 3 and 160),status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.support_messages(id uuid primary key,ticket_id uuid not null references support_tickets(id),author_id uuid references profiles(id),staff boolean not null,body text not null check(length(body) between 1 and 5000),created_at timestamptz not null default now());
create index support_ticket_email_idx on support_tickets(lower(email),created_at desc);
create index support_messages_ticket_idx on support_messages(ticket_id,created_at,id);
create table public.support_rate_limits(key text not null,bucket timestamptz not null,n integer not null,primary key(key,bucket));
alter table support_tickets enable row level security;alter table support_messages enable row level security;alter table support_rate_limits enable row level security;
revoke all on support_tickets,support_messages,support_rate_limits from anon,authenticated;
-- Public contact submissions enter through the same-origin server route. There is no anonymous mailbox reader.
create function public.submit_contact(p_id uuid,p_name text,p_email text,p_subject text,p_body text,p_ip_hash text,p_owner uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare k text;n integer;current_bucket timestamptz:=date_trunc('hour',now());existing support_tickets;begin
 if p_id is null or length(trim(p_name)) not between 1 and 160 or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(trim(p_subject)) not between 3 and 160 or length(trim(p_body)) not between 1 and 5000 or p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid contact details';end if;
 if p_owner is not null and not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null and lower(email)=lower(p_email)) then raise exception 'Confirmed email required';end if;
 select * into existing from support_tickets where id=p_id;
 if found then
  if existing.email=lower(trim(p_email)) and existing.subject=trim(p_subject) and existing.owner_id is not distinct from p_owner and exists(select 1 from support_messages where id=p_id and body=trim(p_body)) then return p_id;end if;
  raise exception 'Submission ID already used';
 end if;
 foreach k in array array['ip:'||p_ip_hash,'email:'||md5(lower(trim(p_email)))] loop
  insert into support_rate_limits values(k,current_bucket,1) on conflict(key,bucket) do update set n=support_rate_limits.n+1 returning support_rate_limits.n into n;
  if n>5 then raise exception 'Too many requests. Please try again in an hour.';end if;
 end loop;
 delete from support_rate_limits where support_rate_limits.bucket<now()-interval '2 days';
 insert into support_tickets(id,owner_id,name,email,subject) values(p_id,p_owner,trim(p_name),lower(trim(p_email)),trim(p_subject));
 insert into support_messages(id,ticket_id,author_id,staff,body) values(p_id,p_id,p_owner,false,trim(p_body));
 return p_id;
end $$;
create function public.can_read_support(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from support_tickets t where t.id=p_id and (app_role() in ('admin','operations') or t.owner_id=auth.uid() or exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=t.email)))
$$;
create function public.support_inbox(p_page integer default 1,p_status text default '') returns jsonb language plpgsql stable security definer set search_path=public as $$
declare total integer;rows_out jsonb;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_page is null or p_page not between 1 and 100000 or p_status is null or p_status not in ('','open','in_progress','resolved','closed') then raise exception 'Invalid inbox filter';end if;
 select count(*) into total from support_tickets t where can_read_support(t.id) and (p_status='' or t.status=p_status);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.id),'[]') into rows_out from (select * from support_tickets t where can_read_support(t.id) and (p_status='' or t.status=p_status) order by updated_at desc,id limit 50 offset (p_page-1)*50) x;
 return jsonb_build_object('count',total,'rows',rows_out);
end $$;
create function public.support_thread(p_id uuid,p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare ticket support_tickets;messages jsonb;n integer;begin
 if not can_read_support(p_id) then raise exception 'Forbidden';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception 'Invalid page';end if;
 select * into ticket from support_tickets where id=p_id;
 select count(*) into n from support_messages where ticket_id=p_id;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') into messages from(select id,staff,body,created_at from support_messages where ticket_id=p_id order by created_at,id limit 50 offset (p_page-1)*50) x;
 return jsonb_build_object('ticket',to_jsonb(ticket),'messages',messages,'count',n);
end $$;
create function public.reply_support(p_ticket uuid,p_id uuid,p_body text,p_status text default null) returns void language plpgsql security definer set search_path=public as $$
declare t support_tickets;m support_messages;is_staff boolean:=coalesce(app_role() in ('admin','operations'),false);begin
 if not can_read_support(p_ticket) then raise exception 'Forbidden';end if;
 if p_id is null or length(trim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Write a reply of 1–5000 characters';end if;
 if p_status is not null and (not is_staff or p_status not in ('open','in_progress','resolved','closed')) then raise exception 'Forbidden status change';end if;
 select * into t from support_tickets where id=p_ticket for update;
 select * into m from support_messages where id=p_id;
 if found then
  if m.ticket_id=p_ticket and m.author_id=auth.uid() and m.body=trim(p_body) then return;end if;
  raise exception 'Reply ID already used';
 end if;
 if t.status='closed' and not is_staff then raise exception 'This ticket is closed. Start a new request.';end if;
 if exists(select 1 from support_messages where author_id=auth.uid() and created_at>now()-interval '3 seconds') then raise exception 'Please wait a few seconds before replying again';end if;
 insert into support_messages(id,ticket_id,author_id,staff,body) values(p_id,p_ticket,auth.uid(),is_staff,trim(p_body));
 update support_tickets set status=coalesce(p_status,case when not is_staff then 'open' else status end),updated_at=now() where id=p_ticket;
 if is_staff then perform audit('support.replied',jsonb_build_object('ticket',p_ticket,'status',p_status));end if;
end $$;
revoke all on function submit_contact(uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function submit_contact(uuid,text,text,text,text,text,uuid) to service_role;
revoke all on function can_read_support(uuid),support_inbox(integer,text),support_thread(uuid,integer),reply_support(uuid,uuid,text,text) from public,anon;
grant execute on function can_read_support(uuid),support_inbox(integer,text),support_thread(uuid,integer),reply_support(uuid,uuid,text,text) to authenticated;
