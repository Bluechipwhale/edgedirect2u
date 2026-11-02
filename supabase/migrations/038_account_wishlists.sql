create table public.customer_wishlist(owner_id uuid references profiles(id),product_id text references products(id),created_at timestamptz not null default now(),primary key(owner_id,product_id));
alter table customer_wishlist enable row level security;
revoke all on customer_wishlist from public,anon,authenticated;
grant select on customer_wishlist to authenticated;
create policy wishlist_owner_read on customer_wishlist for select using(owner_id=auth.uid());
create function public.account_wishlist() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed account required';end if;
 select jsonb_build_object('owner',auth.uid(),'stored_count',(select count(*) from customer_wishlist where owner_id=auth.uid()),'ids',coalesce((select jsonb_agg(w.product_id order by w.created_at,w.product_id) from customer_wishlist w join products p on p.id=w.product_id where w.owner_id=auth.uid() and p.active and p.archived_at is null and approved_merchant(p.merchant_id)),'[]')) into result;return result;
end $$;
create function public.save_account_wishlist(p_owner uuid,p_ids jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare n integer;begin
 if auth.uid() is null or p_owner is distinct from auth.uid() or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed account required';end if;
 if jsonb_typeof(p_ids) is distinct from 'array' or jsonb_array_length(p_ids)>100 then raise exception 'Save up to 100 products';end if;
 if exists(select 1 from jsonb_array_elements(p_ids) v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 100) then raise exception 'Invalid product IDs';end if;
 n:=jsonb_array_length(p_ids);if (select count(distinct value) from jsonb_array_elements_text(p_ids))<>n then raise exception 'Duplicate product IDs';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'-wishlist',0));
 if (select count(*) from products p where p_ids ? p.id and p.active and p.archived_at is null and approved_merchant(p.merchant_id))<>n then raise exception 'Some products are no longer available. Refresh the wishlist first.';end if;
 delete from customer_wishlist where owner_id=auth.uid() and not(p_ids ? product_id);
 insert into customer_wishlist(owner_id,product_id) select auth.uid(),value from jsonb_array_elements_text(p_ids) on conflict do nothing;
 return account_wishlist();
end $$;
create function public.admin_wishlist_report(p_page integer default 1,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;begin
 if auth.uid() is null or app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 if p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid page';end if;
 with grouped as(select p.id,p.name,p.brand,p.active,count(*) saved_accounts,max(w.created_at) last_saved from customer_wishlist w join products p on p.id=w.product_id group by p.id),paged as(select * from grouped order by saved_accounts desc,id limit p_limit offset (p_page-1)*p_limit)
 select jsonb_build_object('count',(select count(*) from grouped),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.saved_accounts desc,p.id) from paged p),'[]')) into result;return result;
end $$;
revoke all on function account_wishlist(),save_account_wishlist(uuid,jsonb),admin_wishlist_report(integer,integer) from public,anon;
grant execute on function account_wishlist(),save_account_wishlist(uuid,jsonb),admin_wishlist_report(integer,integer) to authenticated;
