import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { readFileSync,readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { csv,businessAction } from '../src/lib/business';
let db:PGlite;
const users=Array.from({length:8},(_,i)=>`30000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [owner,warehouse,accounts,client,seller,itManager,outsider,unconfirmed]=users;
async function as<T>(id:string,fn:()=>Promise<T>):Promise<T>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
async function report(id:string){return as(id,async()=>{const x=await db.query<{r:Record<string,unknown>}>("select business_report((now() at time zone 'Africa/Lagos')::date,(now() at time zone 'Africa/Lagos')::date) r");return x.rows[0].r;});}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;alter default privileges in schema public grant all on tables to authenticated;`);
 for(const f of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'));
 for(let i=0;i<users.length;i++)await db.query('insert into auth.users values($1,$2,$3)',[users[i],`user${i}@example.com`,i===7?null:new Date()]);
 await db.query("update profiles set role='admin' where id=$1",[owner]);
 await db.exec("insert into business_principals values('pz','PZ Cussons'),('other','Other supplier');insert into categories values('qa','QA','');insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,stock,image,description) values('pz-item','pz-item','PZ product','qa','Cussons','edge','E-Edge',10000,20,'',''),('other-item','other-item','Other product','qa','Other','edge','E-Edge',50000,20,'','');insert into business_product_principals values('pz-item','pz'),('other-item','other');");
 for(const [i,role] of [[1,'warehouse_manager'],[2,'accounts'],[3,'client'],[4,'van_sales'],[5,'it_manager'],[7,'accounts']] as const){await as(owner,()=>db.query('select business_set_access($1,$2,$3,true)',[`user${i}@example.com`,role,role==='client'?'pz':null]));await as(users[i],()=>db.query('select business_claim_access()'));}
});
afterAll(async()=>db?.close());
it('activates only confirmed approved accounts and keeps legacy staff permissions narrow',async()=>{
 expect((await as(unconfirmed,()=>db.query('select business_context() c'))).rows[0]).toEqual({c:null});
 expect((await as(outsider,()=>db.query('select business_context() c'))).rows[0]).toEqual({c:null});
 await as(warehouse,async()=>{expect((await db.query('select is_staff() s')).rows[0]).toEqual({s:false});expect((await db.query('select * from orders')).rows).toEqual([]);await expect(db.query('select * from business_access')).rejects.toThrow('permission denied');await expect(db.query('select business_team()')).rejects.toThrow('Forbidden');});
 const w=await report(warehouse);expect(w).toHaveProperty('inventory');expect(w).not.toHaveProperty('finance');expect(w).not.toHaveProperty('van_sales');
 const a=await report(accounts);expect(a).toHaveProperty('finance');expect(a).not.toHaveProperty('inventory');
 await expect(report(outsider)).rejects.toThrow('Forbidden');
 await db.exec('set role anon');try{await expect(db.query('select business_report(current_date,current_date)')).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}
});
it('scopes client inventory and exports at the database boundary',async()=>{
 const c=await report(client);expect(c.inventory).toHaveLength(1);expect(JSON.stringify(c)).toContain('PZ product');expect(JSON.stringify(c)).not.toContain('Other product');expect(c).not.toHaveProperty('finance');expect(c).not.toHaveProperty('sellers');
 for(const user of [client,accounts,outsider])await as(user,()=>expect(db.query("select business_adjust_stock($1,'pz-item',10,'Goods receipt QA')",[randomUUID()])).rejects.toThrow('Forbidden'));
});
it('retries stock receipts safely and prevents removing reservations',async()=>{
 const id=randomUUID();await as(warehouse,async()=>{for(let i=0;i<2;i++)await db.query("select business_adjust_stock($1,'pz-item',10,'Goods receipt QA')",[id]);await expect(db.query("select business_adjust_stock($1,'pz-item',11,'Goods receipt QA')",[id])).rejects.toThrow('reference already used');});
 expect((await db.query("select stock from products where id='pz-item'")).rows[0]).toEqual({stock:30});
 await db.exec("update products set reserved=28 where id='pz-item'");
 await as(warehouse,()=>expect(db.query("select business_adjust_stock($1,'pz-item',-3,'Stock correction QA')",[randomUUID()])).rejects.toThrow('Insufficient'));
 await db.exec("update products set reserved=0 where id='pz-item'");
});
it('tracks custody, idempotent real van sales and separate accounts cash confirmation',async()=>{
 const transfer=randomUUID();await as(warehouse,async()=>{for(let i=0;i<2;i++)await db.query("select business_allocate_van($1,$2,'pz-item',5,'Loading note QA')",[transfer,seller]);});
 expect((await db.query("select stock from products where id='pz-item'")).rows[0]).toEqual({stock:25});
 const sale=randomUUID();await as(seller,async()=>{for(let i=0;i<2;i++)await db.query("select business_record_sale($1,'pz-item',2,'Receipt QA')",[sale]);await expect(db.query("select business_record_sale($1,'pz-item',3,'Receipt QA')",[sale])).rejects.toThrow('reference already used');await expect(db.query("select business_record_sale($1,'pz-item',8,'Receipt QA2')",[randomUUID()])).rejects.toThrow('Insufficient');});
 expect((await report(client)).van_sales).toEqual([expect.objectContaining({quantity:2,amount_kobo:20000,cash_confirmed_at:null})]);
 await as(seller,()=>expect(db.query('select business_confirm_cash($1)',[sale])).rejects.toThrow('Forbidden'));
 await as(accounts,async()=>{await db.query('select business_confirm_cash($1)',[sale]);await db.query('select business_confirm_cash($1)',[sale]);});
 expect((await report(client)).van_sales).toEqual([expect.objectContaining({quantity:2,cash_confirmed_at:expect.any(String)})]);
 expect((await db.query("select quantity from business_van_stock where seller_id=$1 and product_id='pz-item'",[seller])).rows[0]).toEqual({quantity:3});
});
it('snapshots supplier attribution and never exposes other supplier sales to PZ',async()=>{
 await as(warehouse,()=>db.query("select business_allocate_van($1,$2,'other-item',2,'Other van load QA')",[randomUUID(),seller]));
 await as(seller,()=>db.query("select business_record_sale($1,'other-item',1,'Other receipt QA')",[randomUUID()]));
 await as(owner,()=>db.query("select business_map_product('pz-item','other')"));
 const c=await report(client);expect(c.inventory).toEqual([]);expect(c.van_sales).toHaveLength(1);expect(JSON.stringify(c)).not.toContain('Other product');
 await as(owner,()=>db.query("select business_map_product('pz-item','pz')"));
 const order=randomUUID();await db.query("insert into orders(id,customer_id,address,subtotal_kobo,delivery_kobo,total_kobo,reference,expires_at,payment_status) values($1,$2,'{}',10000,0,10000,$3,now(),'paid')",[order,outsider,randomUUID()]);await db.query("insert into order_items(order_id,product_id,name,quantity,price_kobo,merchant_id,business_principal_id) values($1,'pz-item','PZ product',1,10000,'edge','other')",[order]);
 expect((await db.query('select business_principal_id from order_items where order_id=$1',[order])).rows[0]).toEqual({business_principal_id:'pz'});
 expect((await report(client)).online_sales).toEqual([expect.objectContaining({quantity:1,gross_kobo:10000})]);
});
it('revokes IT administration safely after access changes, including reapproval',async()=>{
 expect((await as(itManager,()=>db.query('select app_role() r'))).rows[0]).toEqual({r:'admin'});
 await as(owner,()=>db.query("select business_set_access('user5@example.com','it_manager',null,true)"));await as(itManager,()=>db.query('select business_claim_access()'));
 await as(owner,()=>db.query("select business_set_access('user5@example.com','accounts',null,true)"));
 expect((await as(itManager,()=>db.query('select app_role() r'))).rows[0]).toEqual({r:'customer'});await as(itManager,()=>db.query('select business_claim_access()'));
 await as(owner,()=>expect(db.query("select business_set_access('user0@example.com','accounts',null,true)")).rejects.toThrow('protected'));
 await as(owner,()=>db.query("select business_set_access('user3@example.com','client','pz',false)"));await expect(report(client)).rejects.toThrow('Forbidden');
});
it('escapes CSV formulas and validates idempotency keys',()=>{expect(csv([['=HYPERLINK("bad")',120,' +SUM(1,2)']])).toContain("'=HYPERLINK");expect(businessAction.safeParse({action:'stock',product:'pz-item',quantity:1,reason:'Goods receipt QA'}).success).toBe(false);});
