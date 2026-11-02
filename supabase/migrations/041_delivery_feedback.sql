create table public.delivery_feedback(id uuid primary key default gen_random_uuid(),job_id text not null unique references delivery_jobs(id),owner_id uuid not null references profiles(id),rating integer not null check(rating between 1 and 5),comment text not null check(length(comment) between 3 and 1000),status text not null default 'pending' check(status in ('pending','published','rejected')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table delivery_feedback enable row level security;
revoke all on delivery_feedback from public,anon,authenticated;
grant select on delivery_feedback to authenticated;
create policy feedback_scoped_read on delivery_feedback for select using(owner_id=auth.uid() or app_role()='admin' or (status='published' and app_role()='driver' and exists(select 1 from delivery_jobs j where j.id=job_id and j.driver_id=auth.uid())));
create function public.save_delivery_feedback(p_job text,p_rating integer,p_comment text) returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null or not exists(select 1 from delivery_jobs j join orders o on o.id=j.order_id join payments p on p.reference=o.reference where j.id=p_job and j.status='delivered' and o.customer_id=auth.uid()) then raise exception 'Feedback requires your own delivered, verified paid order';end if;
 insert into delivery_feedback(job_id,owner_id,rating,comment) values(p_job,auth.uid(),p_rating,trim(p_comment)) on conflict(job_id) do update set rating=excluded.rating,comment=excluded.comment,status='pending',updated_at=now() where delivery_feedback.owner_id=auth.uid();
 if not found then raise exception 'Feedback ownership changed; contact support';end if;
 perform audit('delivery.feedback_submitted',jsonb_build_object('job',p_job));
end $$;
create function public.moderate_delivery_feedback(p_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null or app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 if p_status is null or p_status not in ('pending','published','rejected') then raise exception 'Invalid review status';end if;
 update delivery_feedback set status=p_status,updated_at=now() where id=p_id;if not found then raise exception 'Feedback not found';end if;
 perform audit('delivery.feedback_moderated',jsonb_build_object('feedback',p_id,'status',p_status));
end $$;
create function public.my_feedback_deliveries(p_page integer default 1,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid page';end if;
 with matching as(select j.id job_id,o.id order_id,o.reference,d.name driver,f.rating,f.comment,f.status,f.updated_at,o.created_at from delivery_jobs j join orders o on o.id=j.order_id join payments p on p.reference=o.reference join drivers d on d.user_id=j.driver_id left join delivery_feedback f on f.job_id=j.id where j.status='delivered' and o.customer_id=auth.uid()),paged as(select * from matching order by created_at desc,job_id limit p_limit offset (p_page-1)*p_limit)
 select jsonb_build_object('count',(select count(*) from matching),'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.job_id) from paged x),'[]')) into result;return result;
end $$;
create function public.delivery_feedback_report(p_status text default '',p_page integer default 1,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
 if auth.uid() is null or coalesce(app_role(),'') not in ('admin','driver') then raise exception 'Forbidden';end if;
 if p_status is null or p_status not in ('','pending','published','rejected') or p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid filters';end if;
 with matching as(select f.id,f.job_id,j.order_id,d.name driver,f.rating,f.comment,f.status,f.created_at,f.updated_at from delivery_feedback f join delivery_jobs j on j.id=f.job_id join drivers d on d.user_id=j.driver_id where (p_status='' or f.status=p_status) and (app_role()='admin' or (j.driver_id=auth.uid() and f.status='published'))),paged as(select * from matching order by updated_at desc,id limit p_limit offset (p_page-1)*p_limit)
 select jsonb_build_object('count',(select count(*) from matching),'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.id) from paged x),'[]')) into result;return result;
end $$;
revoke all on function save_delivery_feedback(text,integer,text),moderate_delivery_feedback(uuid,text),my_feedback_deliveries(integer,integer),delivery_feedback_report(text,integer,integer) from public,anon;
grant execute on function save_delivery_feedback(text,integer,text),moderate_delivery_feedback(uuid,text),my_feedback_deliveries(integer,integer),delivery_feedback_report(text,integer,integer) to authenticated;
