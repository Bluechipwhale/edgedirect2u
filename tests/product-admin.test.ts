import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { readFileSync,readdirSync } from 'node:fs';

let db:PGlite;
const admin='40000000-0000-4000-8000-000000000001';
const customer='40000000-0000-4000-8000-000000000002';
const merchant='40000000-0000-4000-8000-000000000003';
async function as<T>(id:string,fn:()=>Promise<T>):Promise<T>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  try{return await fn();}finally{await db.exec('reset role');}
}
const productData=(name:string,owner='edge',active=true)=>({
  slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,category_id:'qa-products',brand:'QA',merchant_id:owner,
  price_kobo:125000,image:'https://example.com/product.jpg',images:[],description:'Verified test product',options:{},featured:false,active,
});

beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;`);
  for(const file of readdirSync('supabase/migrations').filter(n=>/^(00[1-9]|01[0-7])_.*\.sql$/.test(n)).sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  for(const [id,email] of [[admin,'admin@example.com'],[customer,'customer@example.com'],[merchant,'merchant@example.com']])
    await db.query('insert into auth.users values($1,$2,now())',[id,email]);
  await db.exec("insert into organizations(id,name,kind) values('qa-merchant','QA Merchant','merchant')");
  await db.query("update profiles set role='admin' where id=$1",[admin]);
  await db.query("update profiles set role='merchant',merchant_id='qa-merchant' where id=$1",[merchant]);
  await db.exec(`insert into categories(id,name,image) values('qa-products','QA Products','');
    insert into merchants(id,name,status) values('qa-merchant','QA Merchant','approved');
    insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,image,description,active)
    select 'item-'||i,'item-'||i,case when i=1 then 'Wide catalogue target' else 'Product '||i end,'qa-products','QA','edge','Edgedirect2u',125000,'https://example.com/product.jpg','Verified test product',true
    from generate_series(1,30) i;
    insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,image,description,active)
    values('merchant-item','merchant-item','Merchant stock','qa-products','QA','qa-merchant','QA Merchant',125000,'https://example.com/product.jpg','Verified test product',true),
      ('draft-item','draft-item','Unpublished stock','qa-products','QA','edge','Edgedirect2u',125000,'https://example.com/product.jpg','Verified test product',false);
    insert into stock_movements(product_id,quantity,reason) values('item-1',5,'Historical receipt');`);
});
afterAll(async()=>db?.close());

it('searches the complete catalogue and filters active, draft, owner, and deleted products',async()=>{
  const found=await as(admin,()=>db.query<{result:{count:number;products:{id:string}[]}}>("select admin_product_catalogue('Wide catalogue target','all','',1) result"));
  expect(found.rows[0].result).toMatchObject({count:1,products:[{id:'item-1'}]});
  const second=await as(admin,()=>db.query<{result:{count:number;products:unknown[]}}>("select admin_product_catalogue('','all','',2) result"));
  expect(second.rows[0].result.count).toBe(32);
  expect(second.rows[0].result.products).toHaveLength(7);
  const own=await as(admin,()=>db.query<{result:{count:number}}>("select admin_product_catalogue('','active','qa-merchant',1) result"));
  expect(own.rows[0].result.count).toBe(1);
  const drafts=await as(admin,()=>db.query<{result:{products:{id:string}[]}}>("select admin_product_catalogue('','draft','',1) result"));
  expect(drafts.rows[0].result.products.map(p=>p.id)).toContain('draft-item');
});

it('allows admin edits to merchant listings while keeping catalogue actions private',async()=>{
  await as(admin,()=>db.query('select save_product($1,$2::jsonb)',['merchant-item',JSON.stringify(productData('Admin edited merchant stock','qa-merchant'))]));
  expect((await db.query<{name:string}>("select name from products where id='merchant-item'")).rows[0].name).toBe('Admin edited merchant stock');
  await expect(as(customer,()=>db.query("select admin_product_catalogue('','','',1)"))).rejects.toThrow('Forbidden');
  await expect(as(merchant,()=>db.query("select admin_product_catalogue('','','',1)"))).rejects.toThrow('Forbidden');
  await expect(as(customer,()=>db.query("select set_product_archived('item-1',true)"))).rejects.toThrow('Forbidden');
  await db.exec('set role anon');
  try{await expect(db.query("select set_product_archived('item-1',true)")).rejects.toThrow('permission denied');}
  finally{await db.exec('reset role');}
});

it('deletes reversibly without losing historical stock or publication state',async()=>{
  await as(admin,()=>db.query("select set_product_archived('item-1',true)"));
  const archived=await db.query<{active:boolean;archived_at:string|null;archived_previous_active:boolean}>("select active,archived_at,archived_previous_active from products where id='item-1'");
  expect(archived.rows[0]).toMatchObject({active:false,archived_previous_active:true});
  expect(archived.rows[0].archived_at).toBeTruthy();
  expect((await db.query("select * from stock_movements where product_id='item-1'")).rows).toHaveLength(1);
  await expect(as(admin,()=>db.query('select save_product($1,$2::jsonb)',['item-1',JSON.stringify(productData('Blocked edit'))]))).rejects.toThrow('Restore product before editing');
  const deleted=await as(admin,()=>db.query<{result:{count:number;products:{id:string}[]}}>("select admin_product_catalogue('Wide catalogue target','archived','',1) result"));
  expect(deleted.rows[0].result).toMatchObject({count:1,products:[{id:'item-1'}]});
  await as(admin,()=>db.query("select set_product_archived('item-1',false)"));
  expect((await db.query<{active:boolean;archived_at:string|null}>("select active,archived_at from products where id='item-1'")).rows[0]).toEqual({active:true,archived_at:null});
  await as(admin,()=>db.query("select set_product_archived('draft-item',true)"));
  await as(admin,()=>db.query("select set_product_archived('draft-item',false)"));
  expect((await db.query<{active:boolean}>("select active from products where id='draft-item'")).rows[0].active).toBe(false);
});
