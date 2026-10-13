-- Editorial category taxonomy. No products, prices, stock or merchant fixtures.
insert into public.categories(id,name,image) values
('electronics','Electronics','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=85'),
('fashion','Fashion','https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=85'),
('home','Home & living','https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=85'),
('beauty','Beauty & care','https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=85'),
('groceries','Food & groceries','https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=85'),
('fitness','Sports & fitness','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=85')
on conflict(id) do nothing;

create index if not exists products_active_recent_idx on public.products(created_at desc) where active;
create index if not exists orders_customer_recent_idx on public.orders(customer_id,created_at desc);
create index if not exists orders_pending_expiry_idx on public.orders(expires_at) where payment_status='pending' and status='awaiting_payment';
create index if not exists addresses_owner_recent_idx on public.addresses(owner_id,created_at desc);
create index if not exists delivery_jobs_driver_recent_idx on public.delivery_jobs(driver_id,created_at desc);
