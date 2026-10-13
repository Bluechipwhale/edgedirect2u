insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('brand-assets','brand-assets',true,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy edge_asset_upload on storage.objects for insert to authenticated with check(bucket_id='brand-assets' and public.app_role()='admin');
create policy edge_asset_read on storage.objects for select using(bucket_id='brand-assets');
create policy asset_register on public.branding_assets for insert to authenticated with check(public.app_role()='admin' and owner_id=auth.uid());
grant insert on public.branding_assets to authenticated;

