import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultTheme, themeSchema, assertPublishable, type Theme } from './theme';
import { products, categories } from './seed';
import { assertRole, checkoutSchema, fee, type CheckoutInput } from './validation';
import type { Actor, Order, Product, RecordRow } from './types';

/** Local development only. A single SQL transaction owns each commerce mutation. */
export class LocalStore {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY, owner TEXT NOT NULL, fingerprint TEXT NOT NULL, order_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS payment_events (reference TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS theme_versions (id TEXT PRIMARY KEY, body TEXT NOT NULL, created_at TEXT NOT NULL);`);
    if (!this.get('settings', 'published')) {
      this.put('settings', 'published', defaultTheme); this.put('settings', 'draft', defaultTheme);
      this.db.prepare('INSERT INTO theme_versions VALUES (?,?,?)').run('initial', JSON.stringify(defaultTheme), new Date().toISOString());
      categories.forEach(c => this.put('categories', c.id, c)); products.forEach(p => this.put('products', p.id, p));
      for (const [id, name] of [['edge', 'Edgedirect2u'], ['m-stride', 'Stride Store'], ['m-forma', 'Forma Living'], ['m-botanica', 'Botanica Care']]) this.record('merchants', { name, status: 'approved', description: 'Development fixture merchant', commission_bps: id === 'edge' ? 0 : 1000 }, id);
      this.record('warehouses', { name: 'Lagos development warehouse', address: 'Development fixture', active: true }, 'warehouse-lagos');
      this.record('banners', { title: 'Make space for good living.', text: 'Thoughtful details. Everyday comfort. Find your next home favourite.', cta: 'Refresh your space', href: '/categories/home', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85', enabled: true, position: 'home' }, 'banner-home');
      this.record('banners', { title: 'Find your kind of sound.', text: 'Big ideas deserve a better soundtrack.', cta: 'Explore electronics', href: '/categories/electronics', image: products[0].image, enabled: true, position: 'home' }, 'banner-sound');
    }
  }
  get<T>(kind: string, id: string): T | undefined { const row = this.db.prepare('SELECT body FROM documents WHERE kind=? AND id=?').get(kind, id) as { body: string } | undefined; return row ? JSON.parse(row.body) : undefined; }
  list<T>(kind: string): T[] { return (this.db.prepare('SELECT body FROM documents WHERE kind=? ORDER BY rowid DESC').all(kind) as { body: string }[]).map(r => JSON.parse(r.body)); }
  put(kind: string, id: string, body: unknown) { this.db.prepare('INSERT INTO documents VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind, id, JSON.stringify(body)); }
  transaction<T>(fn: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  record(kind: string, data: Record<string, unknown>, id: string = randomUUID(), actor?: Actor): RecordRow {
    const existing = this.get<RecordRow>(kind, id);
    const row = { id, kind, data, owner_id: existing?.owner_id || actor?.id, merchant_id: existing?.merchant_id || actor?.merchantId, created_at: existing?.created_at || new Date().toISOString() };
    this.put(kind, id, row); return row;
  }
  audit(actor: Actor, action: string, detail: unknown) { this.record('audit', { actor: actor.id, action, detail }); }
  archiveProduct(actor:Actor,id:string,archive:boolean){
    assertRole(actor.role,['admin']);
    return this.transaction(()=>{
      const product=this.get<Product>('products',id);
      if(!product)throw new Error('Product not found');
      if(archive&&!product.archived_at){
        product.archived_previous_active=product.active;
        product.active=false;
        product.archived_at=new Date().toISOString();
        this.put('products',id,product);
        this.audit(actor,'products.archived',{id,was_active:product.archived_previous_active});
      }else if(!archive&&product.archived_at){
        product.active=Boolean(product.archived_previous_active);
        delete product.archived_at;
        delete product.archived_previous_active;
        this.put('products',id,product);
        this.audit(actor,'products.restored',{id,active:product.active});
      }
      return product;
    });
  }
  theme(actor: Actor, action: 'draft' | 'publish' | 'rollback', config?: Theme, version?: string) {
    assertRole(actor.role, ['admin']);
    return this.transaction(() => {
      const t = action === 'rollback' ? JSON.parse((this.db.prepare('SELECT body FROM theme_versions WHERE id=?').get(version || '') as { body: string } | undefined)?.body || 'null') : config;
      const parsed = themeSchema.parse(t);
      if(action!=='draft')assertPublishable(parsed);
      this.put('settings', 'draft', parsed);
      if (action !== 'draft') { this.put('settings', 'published', parsed); this.db.prepare('INSERT INTO theme_versions VALUES (?,?,?)').run(randomUUID(), JSON.stringify(parsed), new Date().toISOString()); }
      this.audit(actor, `theme.${action}`, { version }); return parsed;
    });
  }
  versions() { return this.db.prepare('SELECT id, created_at FROM theme_versions ORDER BY created_at DESC').all().map(row=>({...row})); }
  expire() {
    for (const order of this.list<Order>('orders').filter(o => o.payment_status === 'pending' && o.status === 'awaiting_payment' && Date.parse(o.expires_at) < Date.now())) {
      for (const item of order.items) { const p = this.get<Product>('products', item.product_id)!; p.reserved -= item.quantity; this.put('products', p.id, p); this.record('stock_movements', { product_id: p.id, quantity: item.quantity, reason: 'Reservation expired', order_id: order.id }); }
      order.status = 'expired'; this.put('orders', order.id, order);
    }
  }
  checkout(actor: Actor, raw: CheckoutInput): Order {
    const input = checkoutSchema.parse(raw);
    return this.transaction(() => {
      this.expire();
      const fingerprint = JSON.stringify({ items: input.items, address: input.address, coupon: input.coupon });
      const prior = this.db.prepare('SELECT * FROM idempotency WHERE key=?').get(input.key) as { owner: string; fingerprint: string; order_id: string } | undefined;
      if (prior) { if (prior.owner !== actor.id || prior.fingerprint !== fingerprint) throw new Error('Idempotency key already used for a different checkout'); return this.get<Order>('orders', prior.order_id)!; }
      const quantities = new Map<string, number>();
      const items = input.items.map(i => {
        const p = this.get<Product>('products', i.product_id);
        if (!p || !p.active || this.get<RecordRow>('merchants',p.merchant_id)?.data.status !== 'approved') throw new Error('Product no longer available');
        if (Object.keys(i.options).some(k => !p.options[k])) throw new Error('Invalid product option');
        for (const [key, values] of Object.entries(p.options)) if (!values.includes(i.options[key])) throw new Error(`Select a valid ${key} for ${p.name}`);
        quantities.set(p.id, (quantities.get(p.id) || 0) + i.quantity);
        return { ...i, name: p.name, price_kobo: p.price_kobo, merchant_id: p.merchant_id };
      });
      for (const [id, qty] of quantities) { const p = this.get<Product>('products', id)!; if (p.stock - p.reserved < qty) throw new Error(`Insufficient stock: ${p.name}`); p.reserved += qty; this.put('products', id, p); }
      const subtotal = items.reduce((s, i) => s + i.quantity * i.price_kobo, 0);
      let discount = 0;
      if (input.coupon) { const c = this.list<RecordRow>('coupons').find(c => c.data.code === input.coupon.toUpperCase() && c.data.active === true); if (!c || (c.data.ends_at && Date.parse(String(c.data.ends_at)) < Date.now())) throw new Error('Coupon is invalid or expired'); discount = Math.min(subtotal, Math.floor(subtotal * Number(c.data.percent) / 100)); }
      const allocation = new Map<string, number>(); items.forEach(i => allocation.set(i.merchant_id, (allocation.get(i.merchant_id) || 0) + i.price_kobo * i.quantity));
      const order: Order = { id: randomUUID(), customer_id: actor.id, items, address: input.address, status: 'awaiting_payment', payment_status: 'pending', subtotal_kobo: subtotal, delivery_kobo: fee(input.address.state), discount_kobo: discount, total_kobo: subtotal + fee(input.address.state) - discount, reference: `edge-${randomUUID()}`, expires_at: new Date(Date.now() + 30 * 60000).toISOString(), created_at: new Date().toISOString(), allocations: [...allocation].map(([merchant_id, total_kobo]) => ({ merchant_id, total_kobo, status: 'pending' })) };
      this.put('orders', order.id, order); this.db.prepare('INSERT INTO idempotency VALUES (?,?,?,?)').run(input.key, actor.id, fingerprint, order.id);
      for (const item of items) this.record('stock_movements', { product_id: item.product_id, quantity: -item.quantity, reason: 'Reserved at checkout', order_id: order.id });
      this.audit(actor, 'order.created', { id: order.id }); return order;
    });
  }
  verifiedPayment(reference: string, amount: number, currency: string, status: string) {
    return this.transaction(() => {
      const o = this.list<Order>('orders').find(o => o.reference === reference); if (!o) throw new Error('Unknown payment reference');
      if (status !== 'success' || amount !== o.total_kobo || currency !== 'NGN') throw new Error('Payment verification mismatch');
      if (this.db.prepare('SELECT reference FROM payment_events WHERE reference=?').get(reference)) return o;
      if (o.status !== 'awaiting_payment' || Date.parse(o.expires_at) < Date.now()) throw new Error('Reservation expired; payment requires reconciliation');
      for (const i of o.items) { const p = this.get<Product>('products', i.product_id)!; p.stock -= i.quantity; p.reserved -= i.quantity; this.put('products', p.id, p); this.record('stock_movements', { product_id: p.id, quantity: -i.quantity, reason: 'Paid sale', order_id: o.id }); }
      o.payment_status = 'paid'; o.status = 'processing'; let remainingDiscount = o.discount_kobo;
      o.allocations.forEach((a,index) => { a.status = 'processing'; const discount = index === o.allocations.length-1 ? remainingDiscount : Math.floor(o.discount_kobo * a.total_kobo / o.subtotal_kobo); remainingDiscount -= discount; const bps = a.merchant_id === 'edge' ? 0 : Number(this.get<RecordRow>('merchants',a.merchant_id)?.data.commission_bps || 0); const commission = Math.floor((a.total_kobo-discount)*bps/10000); this.record('merchant_ledger', { order_id: o.id, merchant_id: a.merchant_id, gross_kobo: a.total_kobo, discount_kobo: discount, commission_kobo: commission, net_kobo: a.total_kobo-discount-commission, status: 'pending_settlement' }); });
      this.put('orders', o.id, o); this.db.prepare('INSERT INTO payment_events VALUES (?)').run(reference); return o;
    });
  }
  adjustStock(actor: Actor, id: string, quantity: number, reason: string) {
    assertRole(actor.role, ['admin', 'operations', 'merchant']);
    return this.transaction(() => { const p = this.get<Product>('products', id); if (!p || (actor.role === 'merchant' && p.merchant_id !== actor.merchantId)) throw new Error('Forbidden'); if (!Number.isSafeInteger(quantity) || !reason.trim() || p.stock + quantity < p.reserved) throw new Error('Invalid adjustment or stock is reserved'); p.stock += quantity; this.put('products', id, p); this.record('stock_movements', { product_id: id, quantity, reason, actor: actor.id }); this.audit(actor, 'stock.adjusted', { id, quantity, reason }); return p; });
  }
  scopedOrders(actor: Actor) { return this.list<Order>('orders').filter(o => actor.role === 'admin' || actor.role === 'operations' || (actor.role === 'merchant' ? o.allocations.some(a => a.merchant_id === actor.merchantId) : o.customer_id === actor.id)).map(o => actor.role === 'merchant' ? { ...o, customer_id: '', reference: '', subtotal_kobo: o.allocations.find(a => a.merchant_id === actor.merchantId)!.total_kobo, delivery_kobo: 0, discount_kobo: 0, address: { name: '', email: '', phone: '', street: '', city: '', state: '' }, items: o.items.filter(i => i.merchant_id === actor.merchantId), allocations: o.allocations.filter(a => a.merchant_id === actor.merchantId), total_kobo: o.allocations.find(a => a.merchant_id === actor.merchantId)!.total_kobo } : o); }
  refund(actor: Actor, orderId: string, amount: number) { assertRole(actor.role, ['admin']); return this.transaction(() => { const o = this.get<Order>('orders', orderId); if (!o || o.payment_status !== 'paid' || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid refund'); const refunded = this.list<RecordRow>('refunds').filter(r => r.data.order_id === orderId).reduce((s,r) => s + Number(r.data.amount_kobo), 0); if (refunded + amount > o.total_kobo) throw new Error('Refund exceeds paid amount'); const r = this.record('refunds', { order_id: orderId, amount_kobo: amount, status: 'requested' }); this.audit(actor, 'refund.requested', r); return r; }); }
  delivery(actor: Actor, id: string, status: string, note: string, proof?: string) {
    return this.transaction(() => { const job = this.get<RecordRow>('deliveries', id); if (!job || !(actor.role === 'admin' || actor.role === 'operations' || (actor.role === 'driver' && job.data.driver_id === actor.id))) throw new Error('Forbidden'); const transitions: Record<string, string[]> = { assigned: ['picked_up', 'failed'], picked_up: ['in_transit', 'failed'], in_transit: ['delivered', 'failed'], failed: ['assigned'] }; if (!transitions[String(job.data.status)]?.includes(status)) throw new Error('Invalid delivery transition'); if (status === 'delivered' && !proof?.trim()) throw new Error('Recipient confirmation required'); if (status === 'failed' && !note.trim()) throw new Error('Failure reason required'); job.data.status = status; this.put('deliveries', id, job); if(status==='delivered'){const order=this.get<Order>('orders',String(job.data.order_id));if(order){order.status='delivered';this.put('orders',order.id,order);}} this.record('delivery_events', { delivery_id: id, status, note, proof, actor: actor.id }); this.audit(actor, 'delivery.updated', { id, status }); return job; });
  }
}
let store: LocalStore | undefined;
export function localStore() { if (!store) store = new LocalStore(process.env.LOCAL_DATABASE_PATH || '.data/edgedirect2u.sqlite'); return store; }

