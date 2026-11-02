-- Inventory retains draft records, but procurement alerts apply to published SKUs.
create or replace function public.inventory_catalogue(p_query text default '',p_owner text default '',p_low boolean default false,p_page integer default 1,p_limit integer default 50) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare q text:=lower(trim(coalesce(p_query,'')));result jsonb;begin
 if auth.uid() is null or not is_staff() then raise exception 'Forbidden';end if;
 if length(q)>120 or length(coalesce(p_owner,''))>100 or p_low is null or p_page is null or p_page not between 1 and 100000 or p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid inventory filters';end if;
 with matched as(select * from products p where p.archived_at is null and (q='' or strpos(lower(concat_ws(' ',p.id,p.name,p.brand,p.merchant_name)),q)>0) and (coalesce(p_owner,'')='' or p.merchant_id=p_owner) and (not p_low or (p.active and p.available_stock<=p.reorder_level))),paged as(select * from matched order by name,id limit p_limit offset (p_page-1)*p_limit)
 select jsonb_build_object('count',(select count(*) from matched),'low_count',(select count(*) from matched where active and available_stock<=reorder_level),'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from paged p),'[]')) into result;return result;
end $$;
