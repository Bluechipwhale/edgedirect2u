import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {defaultTheme} from '../src/lib/theme';

let db:PGlite;
const admin='50000000-0000-4000-8000-000000000001';
const customer='50000000-0000-4000-8000-000000000002';
const period=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lagos'});
async function signedIn(id:string){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;");
 for(const name of readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())',[admin,'admin@example.com',customer,'customer@example.com']);
 await db.query("update profiles set role='admin' where id=$1",[admin]);
 await db.exec("insert into categories values('report-qa','Report QA','');insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,stock,image,description) values('report-item','report-item','Reported product','report-qa','QA','edge','E-Edge',10000,8,'','');");
 const order=randomUUID(),reference=`report-${randomUUID()}`;
 await db.query("insert into orders(id,customer_id,status,payment_status,address,subtotal_kobo,delivery_kobo,total_kobo,reference,expires_at) values($1,$2,'processing','paid','{}',10000,0,10000,$3,now()+interval '1 hour')",[order,customer,reference]);
 await db.query("insert into order_items(order_id,product_id,name,quantity,price_kobo,merchant_id) values($1,'report-item','Reported product',1,10000,'edge')",[order]);
 await db.query("insert into order_allocations(order_id,merchant_id,total_kobo) values($1,'edge',10000)",[order]);
 await db.query("insert into payments(reference,amount_kobo,currency,status) values($1,10000,'NGN','success')",[reference]);
});
afterAll(async()=>db?.close());
it('updates starter FMCG copy while preserving private drafts, custom branding and rollback history',async()=>{
 const old={...defaultTheme,heroTitle:'Your everyday.\nWith an edge.',heroEyebrow:'A LITTLE DISCOVERY. A LOT TO LOVE.',logo:'/brand/owner-logo.png',headerHeight:94};
 const draft={...defaultTheme,heroTitle:'My private draft',logo:'/brand/draft-logo.png'};
 await db.query("insert into website_settings(id,config) values('published',$1::jsonb),('draft',$2::jsonb) on conflict(id) do update set config=excluded.config",[JSON.stringify(old),JSON.stringify(draft)]);
 const sql=readFileSync('supabase/migrations/020_fmcg_storefront.sql','utf8');
 await db.exec(sql);
 const settings=(await db.query<{id:string;config:typeof defaultTheme;version_id:string}>('select id,config,version_id from website_settings')).rows;
 const published=settings.find(r=>r.id==='published')!;
 expect(published.config).toMatchObject({heroTitle:'Stock up.\nMove forward.',heroEyebrow:'YOUR EVERYDAY SUPPLY PARTNER',logo:old.logo,headerHeight:94});
 expect(settings.find(r=>r.id==='draft')!.config).toEqual(draft);
 const history=(await db.query<{config:typeof defaultTheme}>('select config from theme_versions')).rows;
 expect(history.some(r=>r.config.heroTitle===old.heroTitle&&r.config.logo===old.logo)).toBe(true);
 expect((await db.query<{config:typeof defaultTheme}>('select config from theme_versions where id=$1',[published.version_id])).rows[0].config).toEqual(published.config);
 await db.exec(sql);
 expect((await db.query('select id from theme_versions')).rows).toHaveLength(history.length);
});
it('shows verified commerce only to admins, with no anonymous access',async()=>{
 await signedIn(customer);
 await db.exec('set role authenticated');
 try{await expect(db.query('select admin_reporting($1,$1)',[period])).rejects.toThrow('Forbidden');}finally{await db.exec('reset role');}
 await db.exec('set role anon');
 try{await expect(db.query('select admin_reporting($1,$1)',[period])).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}
 await signedIn(admin);await db.exec('set role authenticated');
 try{const result=await db.query<{report:{overview:{verified_payments_kobo:number;orders:number};product_sales:{quantity:number;gross_kobo:number}[];merchant_sales:{gross_kobo:number}[]}}>('select admin_reporting($1,$1) report',[period]);expect(result.rows[0].report.overview.verified_payments_kobo).toBe(10000);expect(result.rows[0].report.overview.orders).toBe(1);expect(result.rows[0].report.product_sales).toEqual([expect.objectContaining({quantity:1,gross_kobo:10000})]);expect(result.rows[0].report.merchant_sales).toEqual([expect.objectContaining({gross_kobo:10000})]);await expect(db.query("select admin_reporting('2024-01-01','2026-01-01')")).rejects.toThrow('366 days');}finally{await db.exec('reset role');}
});
