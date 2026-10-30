-- Draft-only creation and explicit metadata/price updates. Stock is never imported.
create function public.admin_import_products(p_rows jsonb,p_mode text default 'skip',p_apply boolean default false,p_expected jsonb default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r jsonb;p products;rows_out jsonb:='[]';tokens jsonb:='[]';errors integer:=0;action text;err text;pid text;token text;begin
 if auth.uid() is null or app_role() is distinct from 'admin' then raise exception 'Forbidden';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 250 or p_mode not in ('skip','update') or p_mode is null or p_apply is null then raise exception 'Invalid import';end if;
 -- The short transaction locks catalogue writes so preview checks and saving cannot race.
 if p_apply then lock table products in share row exclusive mode;end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  err:='';p:=null;action:='create draft';
  if coalesce(r->>'slug','') !~ '^[a-z0-9-]{1,100}$' or length(coalesce(r->>'name','')) not between 1 and 500 or length(coalesce(r->>'brand','')) not between 1 and 160 or length(coalesce(r->>'description','')) not between 1 and 500 or coalesce(r->>'price_kobo','') !~ '^[0-9]{1,10}$' then err:='Invalid product fields';
  elsif (r->>'price_kobo')::bigint not between 1 and 1000000000 then err:='Invalid price';end if;
  if length(coalesce(r->>'image',''))>1000 or coalesce(r->>'image','') ~ '[[:cntrl:]]' or (coalesce(r->>'image','')<>'' and r->>'image' !~ '^https://[^[:space:]]+$' and r->>'image' !~ '^/[^/]') then err:='Invalid image URL';end if;
  if (select count(*) from jsonb_array_elements(p_rows) x where x->>'slug'=r->>'slug')<>1 then err:='Duplicate slug in file';end if;
  if not exists(select 1 from categories where id=r->>'category_id') then err:='Unknown category ID';end if;
  if not exists(select 1 from merchants where id=r->>'merchant_id') then err:='Unknown inventory owner';end if;
  select * into p from products where slug=r->>'slug';
  if p.id is not null then
   action:=case when p_mode='skip' then 'skip existing' else 'update metadata and price' end;
   if p.archived_at is not null and p_mode='update' then err:='Restore archived product before updating';end if;
   if p.merchant_id is distinct from r->>'merchant_id' then err:='Inventory owner conflicts with existing product';end if;
  end if;
  token:=md5(coalesce(to_jsonb(p)::text,'new')||r::text||p_mode);
  tokens:=tokens||jsonb_build_array(token);
  rows_out:=rows_out||jsonb_build_array(jsonb_build_object('slug',r->>'slug','action',action,'error',err,'old_price_kobo',p.price_kobo,'price_kobo',r->'price_kobo'));
  if err<>'' then errors:=errors+1;end if;
 end loop;
 if p_apply then
  if errors>0 then raise exception 'Fix all row errors before importing';end if;
  if p_expected is null or p_expected<>tokens then raise exception 'Catalogue or file changed since preview. Preview again.';end if;
  for r in select value from jsonb_array_elements(p_rows) loop
   select * into p from products where slug=r->>'slug';
   if p.id is not null and p_mode='skip' then continue;end if;
   pid:=coalesce(p.id,gen_random_uuid()::text);
   perform save_product(pid,coalesce(to_jsonb(p),'{}'::jsonb)||r||jsonb_build_object('active',coalesce(p.active,false),'featured',coalesce(p.featured,false),'options',coalesce(p.options,'{}'::jsonb),'images',coalesce(p.images,'[]'::jsonb)));
  end loop;
  perform audit('products.bulk_imported',jsonb_build_object('rows',jsonb_array_length(p_rows),'mode',p_mode));
 end if;
 return jsonb_build_object('rows',rows_out,'tokens',tokens,'errors',errors,'applied',p_apply);
end $$;
revoke all on function public.admin_import_products(jsonb,text,boolean,jsonb) from public,anon;
grant execute on function public.admin_import_products(jsonb,text,boolean,jsonb) to authenticated;
