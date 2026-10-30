import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
const {prepare,sanitize}=createRequire(import.meta.url)('../scripts/import-legacy-history.cjs');
let db:PGlite;const batch='a'.repeat(64);
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.app_role() returns text language sql stable as $$select current_setting('test.role',true)$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;alter default privileges in schema public grant all on tables to authenticated;");
 await db.exec(readFileSync('supabase/migrations/027_legacy_business_history.sql','utf8'));
 await db.query("insert into legacy_history_batches(id,source_site,snapshot_date,counts,reconciliation,verified_at) values($1,'edgedirect2u.com.ng','2026-10-29','{\"orders\":2,\"refund_requests\":0}','{}',now())",[batch]);
 await db.query("insert into legacy_history_records values($1,'orders','10','{\"order_status\":\"paid\",\"customer_name\":\"100% Store\"}',repeat('b',64)),($1,'orders','20','{\"order_status\":\"unpaid\"}',repeat('c',64))",[batch]);
});
afterAll(async()=>db?.close());
async function role(name:string){await db.exec('reset role');await db.query("select set_config('test.uid','50000000-0000-4000-8000-000000000001',false),set_config('test.role',$1,false)",[name]);await db.exec('set role authenticated');}
it('denies anonymous and non-admin history reads; denies direct table access even to admins',async()=>{
 await db.exec('set role anon');await expect(db.query('select admin_legacy_history()')).rejects.toThrow('permission denied');await db.exec('reset role');
 await role('customer');await expect(db.query('select admin_legacy_history()')).rejects.toThrow('Forbidden');
 await expect(db.query('select * from legacy_history_records')).rejects.toThrow('permission denied');
 await role('admin');await expect(db.query('select * from legacy_history_records')).rejects.toThrow('permission denied');await db.exec('reset role');
});
it('pages complete verified snapshots, supports empty tables and treats wildcard search literally',async()=>{
 await role('admin');
 let r=await db.query<{r:{count:number;rows:{source_id:string}[]}}>("select admin_legacy_history('orders',1,'',null,1) r");expect(r.rows[0].r.count).toBe(2);expect(r.rows[0].r.rows[0].source_id).toBe('10');
 r=await db.query("select admin_legacy_history('orders',2,'',null,1) r");expect(r.rows[0].r.rows[0].source_id).toBe('20');
 r=await db.query("select admin_legacy_history('orders',1,'%') r");expect(r.rows[0].r.count).toBe(1);
 r=await db.query("select admin_legacy_history('refund_requests') r");expect(r.rows[0].r).toMatchObject({count:0,rows:[]});
 await expect(db.query("select admin_legacy_history('orders',0)")).rejects.toThrow('Invalid pagination');
 await expect(db.query("select admin_legacy_history('admins')")).rejects.toThrow('Unknown source table');await db.exec('reset role');
 await db.query("insert into legacy_history_batches(id,source_site,snapshot_date,counts,reconciliation) values(repeat('d',64),'edgedirect2u.com.ng','2026-10-30','{}','{}')");
 await role('admin');const latest=await db.query<{r:{batch:{id:string}}}>('select admin_legacy_history() r');expect(latest.rows[0].r.batch.id).toBe(batch);await db.exec('reset role');
});
it('removes credentials and identity/bank fields including JSON-encoded nested fields',()=>{
 expect(sanitize({password:'old',name:'Ada',account_no:'123',details:'{"api_key":"secret","qty":"2"}',nested:{auth_token:'token',phone:'0800'}})).toEqual({name:'Ada',details:'{"qty":"2"}',nested:{phone:'0800'}});
});
it('preserves exact source values and rejects duplicate source keys without running SQL',()=>{
 const sql="CREATE TABLE `orders` (\n`id` int,\n`customer_id` int,\n`order_amount` decimal(12,2)\n) ENGINE=InnoDB; INSERT INTO `orders` VALUES (10,8,'125.50'); CREATE TABLE `admins` (\n`id` int,\n`password` text\n) ENGINE=InnoDB; INSERT INTO `admins` VALUES (1,'secret');";
 const p=prepare(gzipSync(sql),'2026-10-29');expect(p.rows).toHaveLength(1);expect(p.rows[0].data.order_amount).toBe('125.50');expect(p.reconciliation.orders_without_details).toBe(1);expect(p.counts).toEqual({orders:1});
 expect(()=>prepare(gzipSync(sql+"INSERT INTO `orders` VALUES (10,8,'1.00');"),'2026-10-29')).toThrow('duplicate source key');
});
