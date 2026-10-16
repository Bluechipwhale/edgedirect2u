import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {customerCsvCell} from '../src/lib/customer-csv';

const normalize=createRequire(import.meta.url)('../scripts/import-legacy-customers.cjs').normalize as (rows:unknown[])=>{rows:{source_id:string;email:string|null;address:Record<string,unknown>;legacy_order_count:number|null;details:Record<string,unknown>}[];stats:{records:number;legacy_verified:number;legacy_unverified:number;truncated_names:number;blank_names:number;ambiguous_emails:number;unusable_email:number}};

const admin='50000000-0000-4000-8000-000000000001';
const customer='50000000-0000-4000-8000-000000000002';
const unconfirmed='50000000-0000-4000-8000-000000000003';
let db:PGlite;
async function as<T>(id:string,work:()=>Promise<T>):Promise<T>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  try{return await work();}finally{await db.exec('reset role');}
}

beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;alter default privileges in schema public grant all on tables to authenticated;");
  for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
  await db.query('insert into auth.users values($1,$2,now()),($3,$4,now()),($5,$6,null)',[admin,'admin@example.com',customer,'customer@example.com',unconfirmed,'unconfirmed@example.com']);
  await db.query("update profiles set role='admin' where id=$1",[admin]);
  await db.query("insert into legacy_customers(source_id,first_name,last_name,email,phone,address,details,source_checksum) values('101','Old','Customer','customer@example.com','08000000000','{\"street\":\"1 Road\",\"city\":\"Lagos\",\"state\":\"Lagos\"}','{\"legacy_verified\":true}',repeat('a',64)),('102','Not','Confirmed','unconfirmed@example.com','','{}','{\"legacy_verified\":false}',repeat('b',64))");
});
afterAll(async()=>db?.close());

it('keeps imported contacts private and allows only admin directory reads',async()=>{
  await as(customer,async()=>{
    await expect(db.query('select * from legacy_customers')).rejects.toThrow('permission denied');
    await expect(db.query('select admin_legacy_customers()')).rejects.toThrow('Forbidden');
    await expect(db.query('select admin_legacy_customers_export()')).rejects.toThrow('Forbidden');
  });
  await db.exec('set role anon');
  try{
    await expect(db.query('select admin_legacy_customers()')).rejects.toThrow('permission denied');
    await expect(db.query('select admin_legacy_customers_export()')).rejects.toThrow('permission denied');
  }finally{await db.exec('reset role');}
  const result=await as(admin,()=>db.query<{directory:{count:number;rows:{source_id:string}[];missing_email_count:number}}>('select admin_legacy_customers() directory'));
  expect(result.rows[0].directory).toMatchObject({count:2,missing_email_count:0});
  expect(result.rows[0].directory.rows.map(r=>r.source_id)).toEqual(['101','102']);
  const exported=await as(admin,()=>db.query<{rows:{source_id:string}[]}>('select admin_legacy_customers_export() rows'));
  expect(exported.rows[0].rows.map(r=>r.source_id)).toEqual(['101','102']);
});

it('links only a confirmed unique email, keeping passwords and prior orders out of new accounts',async()=>{
  const pending=await as(unconfirmed,()=>db.query<{result:{claimed:boolean}}>('select claim_legacy_customer() result'));
  expect(pending.rows[0].result.claimed).toBe(false);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[unconfirmed]);
  const unverifiedOld=await as(unconfirmed,()=>db.query<{result:{claimed:boolean;manual_review:boolean}}>('select claim_legacy_customer() result'));
  expect(unverifiedOld.rows[0].result).toMatchObject({claimed:false,manual_review:true});
  const claimed=await as(customer,()=>db.query<{result:{claimed:boolean}}>('select claim_legacy_customer() result'));
  expect(claimed.rows[0].result.claimed).toBe(true);
  expect((await db.query<{linked_user_id:string}>('select linked_user_id from legacy_customers where source_id=$1',['101'])).rows[0].linked_user_id).toBe(customer);
  expect((await db.query<{name:string}>('select name from profiles where id=$1',[customer])).rows[0].name).toBe('Old Customer');
  expect((await db.query('select street,city,state from addresses where owner_id=$1',[customer])).rows[0]).toEqual({street:'1 Road',city:'Lagos',state:'Lagos'});
  await as(customer,()=>db.query('select claim_legacy_customer()'));
  expect((await db.query<{n:number}>('select count(*)::int n from addresses where owner_id=$1',[customer])).rows[0].n).toBe(1);
  await db.query("insert into legacy_customers(source_id,email,source_checksum) values('103','customer@example.com',repeat('c',64))");
  const ambiguous=await as(customer,()=>db.query<{result:{claimed:boolean;ambiguous:boolean}}>('select claim_legacy_customer() result'));
  expect(ambiguous.rows[0].result).toMatchObject({claimed:false,ambiguous:true});
});

it('preserves old verification status for every customer and detects conflicting IDs',()=>{
  const input=[
    {legacyId:101,name:'  Ada   A.  ',email:'Ada@Example.COM',phone:'0800',route:'A',totalOrders:'1,234',verified:true,address:{street:'1 Main Road',city:'Ikeja',state:'Lagos'}},
    {legacyId:102,name:'No email',email:'placeholder@old.local',totalOrders:'0',verified:true},
    {legacyId:103,name:'A. Customer...',email:'other@example.com',verified:false},
  ];
  const result=normalize(input);
  expect(result.stats).toMatchObject({records:3,legacy_verified:2,legacy_unverified:1,truncated_names:1,blank_names:0,unusable_email:1});
  expect(result.rows[0]).toMatchObject({source_id:'101',email:'ada@example.com',legacy_order_count:1234,address:{street:'1 Main Road',city:'Ikeja',state:'Lagos'}});
  expect(result.rows[1]).toMatchObject({source_id:'102',email:null,details:{unusable_legacy_email:'placeholder@old.local'}});
  expect(result.rows[2]).toMatchObject({source_id:'103',details:{legacy_verified:false,truncated_name:true}});
  expect(()=>normalize([input[0],{...input[0],name:'Different'}])).toThrow('Conflicting duplicate');
  expect(()=>normalize([{...input[0],legacyId:'../../../etc'}])).toThrow('Invalid legacy customer ID');
  expect(customerCsvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  expect(customerCsvCell('  +SUM(1,2)')).toBe('"\'  +SUM(1,2)"');
});
