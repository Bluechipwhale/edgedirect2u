import { describe,it,expect,beforeEach,afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { LocalStore } from '../src/lib/local-store';
import { defaultTheme,themeSchema,contrast } from '../src/lib/theme';
import type { Actor,Product,Order,RecordRow } from '../src/lib/types';
import type { CheckoutInput } from '../src/lib/validation';
const admin:Actor={id:'admin',role:'admin'},customer:Actor={id:'customer',role:'customer'};
const input=():CheckoutInput=>({key:randomUUID(),items:[{product_id:'p-lamp',quantity:1,options:{}}],address:{name:'Test Customer',email:'test@example.com',phone:'08012345678',street:'123 Test Street',city:'Lagos',state:'Lagos'},coupon:''});
let store:LocalStore;beforeEach(()=>{store=new LocalStore(':memory:');});afterEach(()=>store.db.close());
describe('global branding',()=>{
it('validates defaults and AA body contrast',()=>{expect(themeSchema.safeParse(defaultTheme).success).toBe(true);expect(contrast(defaultTheme.text,defaultTheme.background)).toBeGreaterThanOrEqual(4.5);});
it('rejects malformed styles and active URLs',()=>{expect(themeSchema.safeParse({...defaultTheme,primary:'url(javascript:alert(1))'}).success).toBe(false);expect(themeSchema.safeParse({...defaultTheme,logo:'javascript:alert(1)'}).success).toBe(false);});
it('separates draft from published state',()=>{store.theme(admin,'draft',{...defaultTheme,name:'Draft brand'});expect(store.get<{name:string}>('settings','published')?.name).toBe(defaultTheme.name);});
it('publishes, records history, and rolls back',()=>{store.theme(admin,'publish',{...defaultTheme,name:'New brand'});expect(store.versions()).toHaveLength(2);store.theme(admin,'rollback',undefined,'initial');expect(store.get('settings','published')).toEqual(defaultTheme);expect(store.versions()).toHaveLength(3);});
it('denies customer and merchant publication',()=>{for(const role of ['customer','merchant','driver'] as const)expect(()=>store.theme({id:role,role},'publish',defaultTheme)).toThrow('Forbidden');});
});
describe('checkout & payment',()=>{
it('contains usable product and category fixtures',()=>{expect(store.list('products')).toHaveLength(8);expect(store.list('categories')).toHaveLength(6);});
it('reserves stock while preserving on-hand stock',()=>{store.checkout(customer,input());expect(store.get<Product>('products','p-lamp')?.reserved).toBe(1);expect(store.get<Product>('products','p-lamp')?.stock).toBe(12);});
it('uses server-side prices and owner allocations',()=>{const i=input();i.items.push({product_id:'p-skincare',quantity:1,options:{}});const o=store.checkout(customer,i);expect(o.subtotal_kobo).toBe(6040000);expect(o.allocations).toHaveLength(2);});
it('requires valid variants',()=>{const i=input();i.items[0].product_id='p-shoes';expect(()=>store.checkout(customer,i)).toThrow('valid Size');i.items[0].options={Size:'40'};expect(store.checkout(customer,i).items[0].options.Size).toBe('40');});
it('rejects insufficient stock and rolls back reservations',()=>{const i=input();i.items.push({product_id:'p-skincare',quantity:50,options:{}});expect(()=>store.checkout(customer,i)).toThrow('Insufficient stock');expect(store.get<Product>('products','p-lamp')?.reserved).toBe(0);});
it('prevents duplicate cart lines from exceeding stock',()=>{const i=input();i.items[0].quantity=8;i.items.push({...i.items[0]});expect(()=>store.checkout(customer,i)).toThrow('Insufficient stock');});
it('is retry-safe and rejects reused keys with a different owner or payload',()=>{const i=input();const o=store.checkout(customer,i);expect(store.checkout(customer,i).id).toBe(o.id);expect(()=>store.checkout({id:'other',role:'customer'},i)).toThrow('Idempotency');i.items[0].quantity=2;expect(()=>store.checkout(customer,i)).toThrow('Idempotency');});
it('competing checkouts cannot oversell the final unit',async()=>{store.adjustStock(admin,'p-lamp',-11,'Set final unit');const result=await Promise.allSettled([Promise.resolve().then(()=>store.checkout(customer,input())),Promise.resolve().then(()=>store.checkout({id:'other',role:'customer'},input()))]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(store.get<Product>('products','p-lamp')?.reserved).toBe(1);});
it('releases expired reservations',()=>{const o=store.checkout(customer,input());store.put('orders',o.id,{...o,expires_at:new Date(0).toISOString()});store.transaction(()=>store.expire());expect(store.get<Product>('products','p-lamp')?.reserved).toBe(0);expect(store.get<Order>('orders',o.id)?.status).toBe('expired');});
it('rejects unverified, mismatched amount and currency payments',()=>{const o=store.checkout(customer,input());for(const [amount,currency,status] of [[1,'NGN','success'],[o.total_kobo,'USD','success'],[o.total_kobo,'NGN','pending']] as const)expect(()=>store.verifiedPayment(o.reference,amount,currency,status)).toThrow('mismatch');expect(store.get<Order>('orders',o.id)?.payment_status).toBe('pending');});
it('applies duplicate webhooks once and generates merchant entries',()=>{const o=store.checkout(customer,input());store.verifiedPayment(o.reference,o.total_kobo,'NGN','success');store.verifiedPayment(o.reference,o.total_kobo,'NGN','success');expect(store.get<Product>('products','p-lamp')?.stock).toBe(11);expect(store.get<Product>('products','p-lamp')?.reserved).toBe(0);expect(store.list('merchant_ledger')).toHaveLength(1);});
it('flags late payments for reconciliation',()=>{const o=store.checkout(customer,input());store.put('orders',o.id,{...o,expires_at:new Date(0).toISOString()});expect(()=>store.verifiedPayment(o.reference,o.total_kobo,'NGN','success')).toThrow('expired');});
it('validates coupon expiry and refuses unknown codes',()=>{const i=input();i.coupon='BAD';expect(()=>store.checkout(customer,i)).toThrow('Coupon');});
});
describe('authorization & operational rules',()=>{
it('hides cross-merchant orders and customer PII',()=>{store.checkout(customer,input());expect(store.scopedOrders({id:'m',role:'merchant',merchantId:'m-stride'})).toHaveLength(0);expect(store.scopedOrders({id:'m',role:'merchant',merchantId:'m-forma'})[0].address.email).toBe('');});
it('hides another customer’s orders',()=>{store.checkout(customer,input());expect(store.scopedOrders({id:'other',role:'customer'})).toHaveLength(0);});
it('denies cross-merchant stock changes and protects reserved stock',()=>{store.checkout(customer,input());expect(()=>store.adjustStock({id:'m',role:'merchant',merchantId:'m-stride'},'p-lamp',1,'Receive')).toThrow('Forbidden');expect(()=>store.adjustStock(admin,'p-lamp',-12,'Remove')).toThrow('reserved');});
it('records adjustments in the ledger',()=>{store.adjustStock(admin,'p-lamp',5,'Goods received');expect(store.list<RecordRow>('stock_movements').some(r=>r.data.reason==='Goods received')).toBe(true);});
it('limits refund requests to paid amount and authorized admins',()=>{const o=store.checkout(customer,input());store.verifiedPayment(o.reference,o.total_kobo,'NGN','success');expect(()=>store.refund(customer,o.id,100)).toThrow('Forbidden');store.refund(admin,o.id,o.total_kobo);expect(()=>store.refund(admin,o.id,1)).toThrow('exceeds');});
it('protects assigned driver data and requires proof',()=>{const job=store.record('deliveries',{driver_id:'d1',status:'assigned'});expect(()=>store.delivery({id:'d2',role:'driver'},job.id,'picked_up','')).toThrow('Forbidden');const driver:Actor={id:'d1',role:'driver'};store.delivery(driver,job.id,'picked_up','');store.delivery(driver,job.id,'in_transit','');expect(()=>store.delivery(driver,job.id,'delivered','')).toThrow('confirmation');store.delivery(driver,job.id,'delivered','','Recipient name');expect(store.list('delivery_events')).toHaveLength(3);});
});
