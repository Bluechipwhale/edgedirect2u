import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {parseImportCsv,importColumns} from '@/lib/product-import';
let db:PGlite;const admin='40000000-0000-4000-8000-000000000001',customer='40000000-0000-4000-8000-000000000002';
const item={slug:'new-import',name:'Real product',category_id:'qa',brand:'QA',merchant_id:'edge',price_kobo:199925,image:'',description:'Exact listed pack'};
async function run(rows:unknown[],mode='skip',apply=false,tokens:unknown=null){return (await db.query<{r:{errors:number;tokens:string[];rows:{action:string;error:string}[]}}> ('select admin_import_products($1,$2,$3,$4) r',[rows,mode,apply,tokens])).rows[0].r;}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;`);
 for(const f of readdirSync('supabase/migrations').filter(f=>/^(00[1-9]|01[0-7])_.*\.sql$/.test(f)).sort())await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'));
 await db.exec(readFileSync('supabase/migrations/030_product_bulk_import.sql','utf8'));
 await db.query('insert into auth.users values($1,$2,now()),($3,$4,now())',[admin,'admin@example.com',customer,'customer@example.com']);await db.query("update profiles set role='admin' where id=$1",[admin]);await db.exec("insert into categories(id,name,image) values('qa','QA','');");
});afterAll(async()=>db?.close());
async function as(id:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
it('parses quoted CSV and exact decimal Naira without inventing stock or defaults',()=>{
 const r=parseImportCsv(importColumns.join(',')+'\r\nnew-import,"Product, exact",qa,QA,edge,1999.25,,"Line one\nLine two"');expect(r[0]).toMatchObject({error:'',data:{price_kobo:199925,name:'Product, exact',description:'Line one\nLine two'}});
 expect(()=>parseImportCsv(importColumns.join(',')+'\n"unfinished')).toThrow('Unclosed');
 expect(parseImportCsv(importColumns.join(',')+'\na,A,qa,Q,edge,0,,D')[0].error).toContain('price_naira');
 expect(()=>parseImportCsv('name,price\nA,10')).toThrow('columns');
});
it('reports duplicate input rows and unknown categories without saving any product',async()=>{
 await as(admin);const r=await run([item,{...item,category_id:'missing'}]);expect(r.errors).toBe(2);await expect(run([item,{...item,category_id:'missing'}],'skip',true,r.tokens)).rejects.toThrow('Fix all row errors');await db.exec('reset role');expect((await db.query('select * from products')).rows).toHaveLength(0);
});
it('requires administrator access and forbids anonymous direct imports',async()=>{
 await as(customer);await expect(run([item])).rejects.toThrow('Forbidden');await db.exec('reset role;set role anon');await expect(run([item])).rejects.toThrow('permission denied');await db.exec('reset role');
});
it('requires a preview and atomically creates drafts with zero stock',async()=>{
 await as(admin);await expect(run([item],'skip',true)).rejects.toThrow('Preview again');const r=await run([item]);expect(r.errors).toBe(0);await run([item],'skip',true,r.tokens);await db.exec('reset role');expect((await db.query('select price_kobo,stock,reserved,active from products')).rows[0]).toEqual({price_kobo:199925,stock:0,reserved:0,active:false});
});
it('detects changes since preview and preserves stock, gallery, options and active state on update',async()=>{
 await db.exec("update products set stock=20,reserved=2,active=true,images='[\"https://example.com/photo.png\"]',options='{\"Pack\":[\"Single\"]}' where slug='new-import'");await as(admin);const rows=[{...item,price_kobo:201000}];const preview=await run(rows,'update');await db.exec('reset role');await db.exec("update products set price_kobo=200000 where slug='new-import'");await as(admin);await expect(run(rows,'update',true,preview.tokens)).rejects.toThrow('changed since preview');const fresh=await run(rows,'update');await run(rows,'update',true,fresh.tokens);await db.exec('reset role');expect((await db.query('select price_kobo,stock,reserved,active,images,options from products')).rows[0]).toEqual({price_kobo:201000,stock:20,reserved:2,active:true,images:['https://example.com/photo.png'],options:{Pack:['Single']}});
});
it('skips existing products and refuses archived edits or changing inventory owner',async()=>{
 await as(admin);const skip=await run([{...item,price_kobo:999}]);await run([{...item,price_kobo:999}],'skip',true,skip.tokens);await db.exec('reset role');expect((await db.query<{price_kobo:number}>('select price_kobo from products')).rows[0].price_kobo).toBe(201000);await as(admin);await db.query("select set_product_archived((select id from products limit 1),true)");expect((await run([item],'update')).errors).toBe(1);expect((await run([{...item,merchant_id:'absent'}],'update')).errors).toBe(1);await db.exec('reset role');
});
