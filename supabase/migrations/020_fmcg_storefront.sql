-- Replace only the former starter copy. Preserve owner-authored settings and drafts.
do $$
declare row_settings record;pair record;patch jsonb;candidate jsonb;vid uuid;
before_values jsonb := '{"description":"Your everyday essentials and next favourite finds, all in one place.","announcement":"Good finds, delivered to your doorstep. Discover your next favourite.","heroEyebrow":"A LITTLE DISCOVERY. A LOT TO LOVE.","heroTitle":"Your everyday.\nWith an edge.","heroText":"From the things you need to the finds you didn’t know you loved. Discover a better way to shop, all in one place.","heroCta":"Explore the collection","heroSecondary":"Meet our merchants","seoDescription":"Discover electronics, fashion, home essentials and more at E-Edge Direct 2U.","navigation":[{"label":"New arrivals","href":"/products?sort=newest"},{"label":"Electronics","href":"/categories/electronics"},{"label":"Fashion","href":"/categories/fashion"},{"label":"Home & living","href":"/categories/home"},{"label":"Beauty","href":"/categories/beauty"},{"label":"Shop local","href":"/merchants"}]}'::jsonb;
after_values jsonb := '{"description":"Food, household and personal care essentials for homes, shops and growing businesses.","announcement":"Everyday essentials for your home and business. Browse freely, sign in at checkout.","heroEyebrow":"YOUR EVERYDAY SUPPLY PARTNER","heroTitle":"Stock up.\nMove forward.","heroText":"Discover food, household and personal care essentials from familiar brands. Shop for your home, refill your shelves and manage your orders in one place.","heroCta":"Browse essentials","heroSecondary":"Explore our stores","seoDescription":"Shop food, household, laundry and personal care essentials at E-Edge Direct 2U. Browse freely and sign in at checkout.","navigation":[{"label":"All products","href":"/products"},{"label":"Food & beverages","href":"/categories/fmcg-food-and-beverages"},{"label":"Household","href":"/categories/fmcg-household-cleaning-products"},{"label":"Personal care","href":"/categories/fmcg-personal-care-and-hygiene"},{"label":"Baby care","href":"/categories/fmcg-baby-care-products"},{"label":"Our stores","href":"/merchants"}]}'::jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('global-theme',0));
 for row_settings in select * from website_settings order by id for update loop
  patch := '{}'::jsonb;vid := null;
  for pair in select * from jsonb_each(before_values) loop
   if row_settings.config->pair.key=pair.value then
    patch := patch || jsonb_build_object(pair.key,after_values->pair.key);
   end if;
  end loop;
  if patch='{}'::jsonb then continue;end if;
  candidate := row_settings.config || patch;
  if not coalesce(valid_theme(candidate),false) then raise exception 'FMCG storefront configuration is invalid';end if;
  if row_settings.id='published' then
   insert into theme_versions(config) values(row_settings.config);
   insert into theme_versions(config) values(candidate) returning id into vid;
   if exists(select 1 from platform_companies where id='10000000-0000-4000-8000-000000000001') then
    insert into platform_brand_versions(company_id,config) values('10000000-0000-4000-8000-000000000001',row_settings.config);
   end if;
  end if;
  update website_settings set config=candidate,version_id=coalesce(vid,version_id),updated_at=now() where id=row_settings.id;
  perform audit('storefront.fmcg_content',jsonb_build_object('setting',row_settings.id,'fields',(select jsonb_agg(key) from jsonb_object_keys(patch) key),'previous_publication_retained',true));
 end loop;
end $$;
