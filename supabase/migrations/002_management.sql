create function public.valid_theme(t jsonb) returns boolean language plpgsql immutable as $$ declare k text;link jsonb;begin
if jsonb_typeof(t)<>'object' then return false;end if;
if not t ?& array['name','heroTitle','sticky','announcementEnabled','headingFont','bodyFont','shadow','density','buttonStyle','buttonSize','productLayout','heroAlign','fontSize','scale','radius','width','headerHeight','heroHeight','heroOverlay','navigation','footerLinks','sections'] then return false;end if;
foreach k in array array['primary','secondary','accent','background','surface','text','muted','border','success','warning','error','heroBackground','announcementBackground','announcementText'] loop if coalesce(t->>k,'')!~'^#[a-fA-F0-9]{6}$' then return false;end if;end loop;
foreach k in array array['logo','lightLogo','darkLogo','mobileLogo','favicon','instagram','facebook','heroLink','heroSecondaryLink','heroImage','heroMobileImage','announcementLink'] loop if t->>k is null or (t->>k<>'' and t->>k!~'^(https://|/($|[^/]))') then return false;end if;end loop;
foreach k in array array['fontSize','scale','radius','width','headerHeight','heroHeight','heroOverlay'] loop if jsonb_typeof(t->k) is distinct from 'number' then return false;end if;end loop;
foreach k in array array['sticky','announcementEnabled'] loop if jsonb_typeof(t->k) is distinct from 'boolean' then return false;end if;end loop;
if coalesce(length(t->>'name'),0) not between 2 and 60 or coalesce(length(t->>'heroTitle'),0) not between 1 and 150 then return false;end if;
if t->>'headingFont' not in ('Geist','Georgia','Arial') or t->>'bodyFont' not in ('Geist','Arial','Verdana') or t->>'shadow' not in ('none','soft','strong') or t->>'density' not in ('compact','comfortable','spacious') or t->>'buttonStyle' not in ('solid','outline') or t->>'buttonSize' not in ('small','medium','large') or t->>'productLayout' not in ('four','five') or t->>'heroAlign' not in ('left','center') then return false;end if;
if (t->>'fontSize')::numeric not between 14 and 20 or (t->>'scale')::numeric not between 1 and 1.4 or (t->>'radius')::numeric not between 0 and 28 or (t->>'width')::numeric not between 960 and 1600 or (t->>'headerHeight')::numeric not between 64 and 120 or (t->>'heroHeight')::numeric not between 360 and 700 or (t->>'heroOverlay')::numeric not between 0 and .8 then return false;end if;
if jsonb_typeof(t->'navigation') is distinct from 'array' or jsonb_typeof(t->'footerLinks')<>'array' or jsonb_typeof(t->'sections')<>'array' then return false;end if;
if jsonb_array_length(t->'navigation')>12 or jsonb_array_length(t->'footerLinks')>20 or jsonb_array_length(t->'sections')>5 then return false;end if;
for link in select value from jsonb_array_elements((t->'navigation')||(t->'footerLinks')) loop if length(link->>'label') not between 1 and 50 or coalesce(link->>'href','')!~'^(https://|/($|[^/]))' then return false;end if;end loop;
for link in select value from jsonb_array_elements(t->'sections') loop if link#>>'{}' not in ('categories','featured','banners','new','merchants') then return false;end if;end loop;
return true;exception when others then return false;end $$;
create function public.change_theme(p_action text,p_config jsonb,p_version text default null) returns void language plpgsql security definer set search_path=public as $$ declare t jsonb;vid uuid;begin
if app_role()<>'admin' then raise exception 'Forbidden';end if;
perform pg_advisory_xact_lock(hashtextextended('global-theme',0));
if p_action not in ('draft','publish','rollback') then raise exception 'Invalid theme action';end if;
if p_action='rollback' then select config into t from theme_versions where id=p_version::uuid;if not found then raise exception 'Theme version not found';end if;else t:=p_config;end if;
if valid_theme(t) is not true then raise exception 'Invalid theme configuration';end if;
insert into website_settings(id,config) values('draft',t) on conflict(id) do update set config=excluded.config,updated_at=now();
if p_action<>'draft' then insert into theme_versions(config,created_by) values(t,auth.uid()) returning id into vid;insert into website_settings(id,config,version_id) values('published',t,vid) on conflict(id) do update set config=excluded.config,version_id=excluded.version_id,updated_at=now();end if;
perform audit('theme.'||p_action,jsonb_build_object('version',vid));end $$;

create function public.save_product(p_id text,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$ declare existing products;owner text:=p_data->>'merchant_id';begin
select * into existing from products where id=p_id for update;
if app_role()='merchant' then owner:=current_merchant();if existing.id is not null and existing.merchant_id<>owner then raise exception 'Forbidden';end if;if not exists(select 1 from merchants where id=owner and status='approved') then raise exception 'Merchant approval required';end if;elsif app_role()<>'admin' then raise exception 'Forbidden';end if;
insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,previous_price_kobo,image,images,description,options,featured,active) values(p_id,p_data->>'slug',p_data->>'name',p_data->>'category_id',p_data->>'brand',owner,(select name from merchants where id=owner),(p_data->>'price_kobo')::bigint,(p_data->>'previous_price_kobo')::bigint,p_data->>'image',coalesce(p_data->'images','[]'),p_data->>'description',coalesce(p_data->'options','{}'),coalesce((p_data->>'featured')::boolean,false),coalesce((p_data->>'active')::boolean,true)) on conflict(id) do update set slug=excluded.slug,name=excluded.name,category_id=excluded.category_id,brand=excluded.brand,merchant_id=excluded.merchant_id,merchant_name=excluded.merchant_name,price_kobo=excluded.price_kobo,previous_price_kobo=excluded.previous_price_kobo,image=excluded.image,images=excluded.images,description=excluded.description,options=excluded.options,featured=excluded.featured,active=excluded.active;
perform audit('products.saved',jsonb_build_object('id',p_id));end $$;

create function public.save_record(p_kind text,p_id text,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$ declare uid uuid:=auth.uid();o orders;row_owner uuid;begin
if uid is null then raise exception 'Authentication required';end if;
if p_kind not in ('addresses','returns','reviews') and app_role()<>'admin' then raise exception 'Forbidden';end if;
case p_kind
when 'merchants' then
insert into organizations(id,name,kind) values(p_id,p_data->>'name','merchant') on conflict(id) do update set name=excluded.name;
insert into merchants(id,name,description,email,status,commission_bps) values(p_id,p_data->>'name',coalesce(p_data->>'description',''),coalesce(p_data->>'email',''),p_data->>'status',(p_data->>'commission_bps')::integer) on conflict(id) do update set name=excluded.name,description=excluded.description,email=excluded.email,status=excluded.status,commission_bps=excluded.commission_bps;
if p_data->>'status'='approved' then update profiles set role='merchant',merchant_id=p_id where id=(select owner_id from merchants where id=p_id) and role='customer';end if;
when 'warehouses' then insert into warehouses(id,name,address,active) values(p_id,p_data->>'name',p_data->>'address',(p_data->>'active')::boolean) on conflict(id) do update set name=excluded.name,address=excluded.address,active=excluded.active;
when 'suppliers' then insert into suppliers(id,name,email,phone,address) values(p_id,p_data->>'name',p_data->>'email',coalesce(p_data->>'phone',''),coalesce(p_data->>'address','')) on conflict(id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,address=excluded.address;
when 'purchase_orders' then insert into purchase_orders(id,supplier_id,warehouse_id,notes,status,total_kobo) values(p_id,p_data->>'supplier_id',p_data->>'warehouse_id',coalesce(p_data->>'notes',''),p_data->>'status',(p_data->>'total_kobo')::bigint) on conflict(id) do update set supplier_id=excluded.supplier_id,warehouse_id=excluded.warehouse_id,notes=excluded.notes,status=excluded.status,total_kobo=excluded.total_kobo;
when 'coupons' then insert into coupons(id,code,percent,active,ends_at) values(p_id,p_data->>'code',(p_data->>'percent')::integer,(p_data->>'active')::boolean,nullif(p_data->>'ends_at','')::timestamptz) on conflict(id) do update set code=excluded.code,percent=excluded.percent,active=excluded.active,ends_at=excluded.ends_at;
when 'drivers' then if not exists(select 1 from profiles where id=(p_data->>'user_id')::uuid and role='driver') then raise exception 'User must have the driver role';end if;insert into drivers(id,user_id,name,phone,available) values(p_id,(p_data->>'user_id')::uuid,p_data->>'name',p_data->>'phone',(p_data->>'available')::boolean) on conflict(id) do update set user_id=excluded.user_id,name=excluded.name,phone=excluded.phone,available=excluded.available;
when 'settlements' then insert into settlements(id,merchant_id,amount_kobo,reference,status) values(p_id,p_data->>'merchant_id',(p_data->>'amount_kobo')::bigint,p_data->>'reference',p_data->>'status') on conflict(id) do update set merchant_id=excluded.merchant_id,amount_kobo=excluded.amount_kobo,reference=excluded.reference,status=excluded.status;
when 'addresses' then select owner_id into row_owner from addresses where id=p_id;if row_owner is not null and row_owner<>uid and app_role()<>'admin' then raise exception 'Forbidden';end if;insert into addresses(id,owner_id,name,phone,street,city,state) values(p_id,coalesce(row_owner,uid),p_data->>'name',p_data->>'phone',p_data->>'street',p_data->>'city',p_data->>'state') on conflict(id) do update set name=excluded.name,phone=excluded.phone,street=excluded.street,city=excluded.city,state=excluded.state;
when 'returns' then
select * into o from orders where id=(p_data->>'order_id')::uuid;if not found or o.payment_status<>'paid' or(o.customer_id<>uid and app_role()<>'admin') then raise exception 'Only own paid orders are eligible';end if;
select owner_id into row_owner from returns where id=p_id;if row_owner is not null and row_owner<>uid and app_role()<>'admin' then raise exception 'Forbidden';end if;
insert into returns(id,owner_id,order_id,reason,status) values(p_id,o.customer_id,o.id,p_data->>'reason',case when app_role()='admin' then p_data->>'status' else 'requested' end) on conflict(id) do update set reason=excluded.reason,status=case when app_role()='admin' then excluded.status else returns.status end;
when 'reviews' then
select * into o from orders where id=(p_data->>'order_id')::uuid;if not found or o.payment_status<>'paid' or(o.customer_id<>uid and app_role()<>'admin') or not exists(select 1 from order_items where order_id=o.id and product_id=p_data->>'product_id') then raise exception 'Only verified purchases are eligible';end if;
select owner_id into row_owner from reviews where id=p_id;if row_owner is not null and row_owner<>uid and app_role()<>'admin' then raise exception 'Forbidden';end if;
insert into reviews(id,owner_id,order_id,product_id,rating,comment,status) values(p_id,o.customer_id,o.id,p_data->>'product_id',(p_data->>'rating')::integer,p_data->>'comment',case when app_role()='admin' then p_data->>'status' else 'pending' end) on conflict(id) do update set comment=excluded.comment,rating=excluded.rating,status=case when app_role()='admin' then excluded.status else 'pending' end;
when 'banners','policies','notifications' then insert into website_content(id,kind,data) values(p_id,p_kind,p_data) on conflict(id) do update set data=excluded.data;
else raise exception 'Unknown resource';end case;
perform audit(p_kind||'.saved',jsonb_build_object('id',p_id));end $$;

create function public.apply_merchant(p_data jsonb) returns void language plpgsql security definer set search_path=public as $$ declare mid text:=auth.uid()::text;begin
if auth.uid() is null then raise exception 'Authentication required';end if;
if exists(select 1 from merchants where owner_id=auth.uid()) then raise exception 'You already have a merchant application';end if;
insert into organizations(id,name,kind) values(mid,p_data->>'name','merchant');insert into merchants(id,owner_id,name,email,description,status) values(mid,auth.uid(),p_data->>'name',p_data->>'email',p_data->>'description','pending');perform audit('merchant.applied',jsonb_build_object('id',mid));end $$;
create function public.my_deliveries() returns jsonb language plpgsql stable security definer set search_path=public as $$ declare result jsonb;begin
if not(is_staff() or app_role()='driver') then raise exception 'Forbidden';end if;
select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'kind','deliveries','owner_id',j.driver_id,'created_at',j.created_at,'data',to_jsonb(j)-'id'-'created_at'||jsonb_build_object('address',o.address,'events',coalesce((select jsonb_agg(jsonb_build_object('status',e.status,'note',e.note,'proof',e.proof,'created_at',e.created_at) order by e.created_at) from delivery_events e where e.delivery_id=j.id),'[]'::jsonb)))),'[]') into result from delivery_jobs j join orders o on o.id=j.order_id where is_staff() or j.driver_id=auth.uid();return result;end $$;
create function public.set_user_role(p_user uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$ begin
if app_role()<>'admin' or p_user=auth.uid() then raise exception 'Forbidden';end if;if p_role not in ('customer','admin','operations','driver') then raise exception 'Merchant access requires application approval';end if;update profiles set role=p_role where id=p_user;perform audit('role.changed',jsonb_build_object('user',p_user,'role',p_role));end $$;
revoke execute on function change_theme(text,jsonb,text),save_product(text,jsonb),save_record(text,text,jsonb),apply_merchant(jsonb),my_deliveries(),set_user_role(uuid,text) from public,anon;
grant execute on function change_theme(text,jsonb,text),save_product(text,jsonb),save_record(text,text,jsonb),apply_merchant(jsonb),my_deliveries(),set_user_role(uuid,text) to authenticated;


