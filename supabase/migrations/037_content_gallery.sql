create table public.gallery_media(id text primary key,title text not null check(length(title) between 1 and 500),image text not null check(length(image) between 1 and 1000 and image !~ '[[:cntrl:]]' and (image ~ '^https://[^[:space:]]+$' or image ~ '^/[^/]')),description text not null default '' check(length(description)<=1000),sort_order integer not null default 0 check(sort_order between 0 and 100000),active boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.content_pages(id text primary key,slug text not null unique check(slug ~ '^[a-z0-9-]{1,100}$'),title text not null check(length(title) between 1 and 500),content text not null check(length(content) between 1 and 20000),active boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create function public.audit_managed_content() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_when='BEFORE' then new.updated_at:=now();return new;end if;
 perform audit(tg_table_name||'.saved',jsonb_build_object('id',new.id,'active',new.active));return new;
end $$;
do $$declare t text;begin foreach t in array array['gallery_media','content_pages'] loop
 execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);
 execute format('grant select on %I to anon,authenticated',t);execute format('grant insert,update on %I to authenticated',t);
 execute format('create policy content_read on %I for select using(active or app_role()=''admin'')',t);
 execute format('create policy content_write on %I for all using(auth.uid() is not null and app_role()=''admin'') with check(auth.uid() is not null and app_role()=''admin'')',t);
 execute format('create trigger content_touch before update on %I for each row execute function audit_managed_content()',t);
 execute format('create trigger content_audit after insert or update on %I for each row execute function audit_managed_content()',t);
end loop;end $$;
revoke all on function audit_managed_content() from public,anon,authenticated;
