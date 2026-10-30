import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec("create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function app_role() returns text language sql stable as $$select current_setting('test.role',true)$$;create function audit(text,jsonb) returns void language sql as $$select$$;create table brands(id text primary key,name text unique not null);create table merchants(id text primary key,status text);create table products(id text primary key,brand text,merchant_id text,active boolean,archived_at timestamptz);insert into merchants values('approved','approved'),('suspended','suspended');insert into products values('one','PZ','approved',true,null),('draft','Draft brand','approved',false,null),('blocked','Blocked brand','suspended',true,null);");
 await db.exec(readFileSync('supabase/migrations/028_managed_brands.sql','utf8'));
});afterAll(async()=>db?.close());
async function role(name:string){await db.exec('reset role');await db.query("select set_config('test.uid','50000000-0000-4000-8000-000000000001',false),set_config('test.role',$1,false)",[name]);await db.exec('set role authenticated');}
it('exposes only active brands with published products from approved merchants',async()=>{
 await db.exec('set role anon');const r=await db.query<{r:{name:string;product_count:number}[]}>('select published_brands() r');expect(r.rows[0].r).toEqual([expect.objectContaining({name:'PZ',product_count:1})]);await db.exec('reset role');
});
it('denies non-admin mutation and directory access, including anonymous calls',async()=>{
 await db.exec('set role anon');await expect(db.query('select admin_brand_registry()')).rejects.toThrow('permission denied');await db.exec('reset role');await role('customer');await expect(db.query('select admin_brand_registry()')).rejects.toThrow('Forbidden');await expect(db.query("select save_brand_registry('x','{}')")).rejects.toThrow('Forbidden');await db.exec('reset role');
});
it('updates branding reversibly while preserving product names and product access',async()=>{
 await role('admin');const r=await db.query<{r:{rows:{id:string;name:string}[]}}>('select admin_brand_registry() r');const id=r.rows[0].r.rows.find(r=>r.name==='PZ')!.id;
 await db.query('select save_brand_registry($1,$2)',[id,{name:'PZ',display_name:'PZ Cussons',logo_url:'https://example.com/logo.png',description:'Care essentials',active:false}]);
 expect((await db.query<{r:unknown[]}>('select published_brands() r')).rows[0].r).toEqual([]);
 await expect(db.query('select save_brand_registry($1,$2)',[id,{name:'Renamed',active:true}])).rejects.toThrow('catalogue name is in use');
 await db.query('select save_brand_registry($1,$2)',[id,{name:'PZ',display_name:'PZ Cussons',active:true}]);await db.exec('reset role');expect((await db.query<{brand:string}>('select brand from products where id=$1',['one'])).rows[0].brand).toBe('PZ');
});
it('rejects unsafe logo schemes and invalid pagination',async()=>{
 await role('admin');await expect(db.query("select save_brand_registry('bad',$1)",[{name:'Test',active:true,logo_url:'javascript:alert(1)'}])).rejects.toThrow('Invalid brand');await expect(db.query("select admin_brand_registry('',0)")).rejects.toThrow('Invalid page');await db.exec('reset role');
});

