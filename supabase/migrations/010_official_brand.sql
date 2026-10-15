-- Explicit brand update, retaining storefront content and the previous published version.
do $$ declare patch jsonb;vid uuid;published jsonb;begin
perform pg_advisory_xact_lock(hashtextextended('global-theme',0));
patch='{"name":"E-Edge Direct 2U","tagline":"Commerce. Delivery. Distribution.","copyright":"© 2026 E-Edge Direct 2U. All rights reserved.","logo":"/brand/e-edge-direct-2u-official.png","lightLogo":"/brand/e-edge-direct-2u-official.png","darkLogo":"","mobileLogo":"","favicon":"/icon.svg","primary":"#B93400","secondary":"#111111","accent":"#FF4D00","background":"#FAFAF9","surface":"#FFFFFF","text":"#171717","muted":"#62615F","border":"#E8E4E0","announcementBackground":"#111111","heroBackground":"#FFF0E9","seoTitle":"E-Edge Direct 2U — Commerce. Delivery. Distribution.","seoDescription":"Discover electronics, fashion, home essentials and more at E-Edge Direct 2U."}'::jsonb;
select config into published from website_settings where id='published' for update;
insert into theme_versions(config) values(published);
insert into platform_brand_versions(company_id,config) values('10000000-0000-4000-8000-000000000001',published);
insert into theme_versions(config) values(published||patch) returning id into vid;
update website_settings set config=config||patch,updated_at=now(),version_id=case when id='published' then vid else version_id end;
insert into platform_audit(company_id,action,detail) values('10000000-0000-4000-8000-000000000001','brand.official_release','{"method":"audited_migration","previous_version_retained":true}');
end $$;
