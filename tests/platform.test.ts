import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { readFileSync,readdirSync } from 'node:fs';
import { defaultTheme } from '../src/lib/theme';
let db:PGlite;let companyA:string,companyB:string,storeA:string,storeB:string,assignmentA:string;
const ids=Array.from({length:6},(_,i)=>`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [root,adminA,adminB,agentA,agentB,outsider]=ids;
async function as<T>(id:string,action:()=>Promise<T>,aal='aal1'):Promise<T>{await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id,aal})]);await db.exec('set role authenticated');try{return await action();}finally{await db.exec('reset role');}}
async function scalar(sql:string,args:unknown[]=[]){const r=await db.query<{id:string}>(sql,args);return r.rows[0].id;}
beforeAll(async()=>{
  db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;`);
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){if(file.startsWith('009'))await db.exec('alter default privileges in schema public grant all on tables to authenticated');await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));}
  for(let i=0;i<ids.length;i++)await db.query('insert into auth.users values($1,$2,now())',[ids[i],`person${i}@example.com`]);
  await db.query('insert into platform_admins(user_id) values($1)',[root]);
  companyA=await as(root,()=>scalar('select platform_create_company($1,$2,$3,$4,$5) id',['company-a','Company A','person1@example.com','enterprise',defaultTheme]),'aal2');
  companyB=await as(root,()=>scalar('select platform_create_company($1,$2,$3,$4,$5) id',['company-b','Company B','person2@example.com','field_operations',defaultTheme]),'aal2');
  await as(adminA,()=>db.query("select company_set_member($1,'person3@example.com','field_agent',true)",[companyA]));
  await as(adminB,()=>db.query("select company_set_member($1,'person4@example.com','field_agent',true)",[companyB]));
  storeA=await as(adminA,()=>scalar("select field_save_store($1,'Lagos store','12 Market Street, Lagos',6.5,3.4,null) id",[companyA]));
  storeB=await as(adminB,()=>scalar("select field_save_store($1,'Abuja store','12 Central Street, Abuja',9.0,7.4,150) id",[companyB]));
  assignmentA=await as(adminA,()=>scalar("select field_assign($1,$2,$3,(now() at time zone 'Africa/Lagos')::date) id",[companyA,storeA,agentA]));
});
afterAll(async()=>db?.close());
it('separates platform owners from company administrators and requires MFA',async()=>{
  await as(root,async()=>{expect(await scalar('select platform_is_admin()::text id')).toBe('false');await expect(db.query('select platform_set_active($1,false)',[companyB])).rejects.toThrow('verified MFA');});
  await as(adminA,async()=>{expect(await scalar('select platform_is_admin()::text id')).toBe('false');await expect(db.query('select platform_set_active($1,false)',[companyB])).rejects.toThrow('verified MFA');},'aal2');
  await as(root,async()=>expect(await scalar('select platform_is_admin()::text id')).toBe('true'),'aal2');
});
it('isolates company rows, memberships, stores, roles and all direct writes',async()=>{
  await as(adminA,async()=>{const companies=await db.query('select id from platform_companies');expect(companies.rows).toEqual([{id:companyA}]);expect((await db.query('select id from field_stores')).rows).toEqual([{id:storeA}]);expect((await db.query('select user_id from platform_memberships where company_id=$1',[companyB])).rows).toEqual([]);await expect(db.query("insert into platform_memberships(company_id,user_id,role) values($1,$2,'company_admin')",[companyB,adminA])).rejects.toThrow();await expect(db.query("select company_set_member($1,'person5@example.com','company_admin',true)",[companyB])).rejects.toThrow('Forbidden');});
  await as(outsider,async()=>{expect((await db.query('select * from field_visits')).rows).toEqual([]);expect((await db.query('select * from platform_companies')).rows).toEqual([]);});
});
it('does not expose the flagship private commerce through new company-admin membership',async()=>{
  await as(adminA,async()=>{expect(await scalar('select app_role() id')).toBe('customer');await expect(db.query('select dashboard_metrics()')).rejects.toThrow('Forbidden');});
});
it('prevents unported modules from being enabled even by an administrator',async()=>{
  const r=await db.query<{module:string;enabled:boolean}>('select module,enabled from platform_modules where company_id=$1 order by module',[companyA]);expect(r.rows.find(m=>m.module==='commerce')?.enabled).toBe(false);await expect(db.query("update platform_modules set enabled=true where company_id=$1 and module='commerce'",[companyA])).rejects.toThrow('check constraint');
});
it('publishes brand drafts independently and rejects cross-company rollback',async()=>{
  const branded={...defaultTheme,name:'Company A published',primary:'#B93400'};
  await as(adminA,async()=>{await db.query("select company_brand($1,'draft',$2,null)",[companyA,branded]);const a=await db.query<{brand:{name:string};brand_draft:{name:string}}>('select brand,brand_draft from platform_companies where id=$1',[companyA]);expect(a.rows[0].brand.name).toBe(defaultTheme.name);expect(a.rows[0].brand_draft.name).toBe(branded.name);await db.query("select company_brand($1,'publish',$2,null)",[companyA,branded]);});
  const other=await db.query<{brand:{name:string}}>('select brand from platform_companies where id=$1',[companyB]);expect(other.rows[0].brand.name).toBe(defaultTheme.name);
  const version=await scalar('select id from platform_brand_versions where company_id=$1 limit 1',[companyA]);await as(adminB,()=>expect(db.query("select company_brand($1,'rollback',null,$2)",[companyB,version])).rejects.toThrow('unavailable'));
});
it('rejects cross-company store assignments and unassigned store discovery',async()=>{
  await as(adminA,()=>expect(db.query('select field_assign($1,$2,$3,current_date)',[companyA,storeB,agentA])).rejects.toThrow('Store unavailable'));
  await as(agentA,async()=>expect((await db.query('select id from field_stores')).rows).toEqual([{id:storeA}]));
});
const checkin=(capture=new Date(),accuracy=5,lat=6.5,lng=3.4)=>db.query<{id:string}>('select field_checkin($1,$2,$3,$4,$5,$6) id',[companyA,assignmentA,lat,lng,accuracy,capture.toISOString()]);
it('requires an active shift and explicit web-location policy',async()=>{
  await as(agentA,async()=>{await expect(checkin()).rejects.toThrow('disabled');await db.query("select field_shift($1,'in')",[companyA]);});
  await as(adminA,()=>db.query('select company_field_policy($1,100,30,true)',[companyA]));
});
it('enforces fresh, accurate and uncertainty-aware locations',async()=>{
  await as(agentA,async()=>{await expect(checkin(new Date(Date.now()-120000))).rejects.toThrow('Fresh location');await expect(checkin(new Date(Date.now()+60000))).rejects.toThrow('Fresh location');await expect(checkin(new Date(),51)).rejects.toThrow('Fresh location');await expect(checkin(new Date(),30,6.5007)).rejects.toThrow('uncertainty');await expect(checkin(new Date(),5,7)).rejects.toThrow('geofence');});
});
it('never counts check-in as completion, preserves retries and locks completed evidence',async()=>{
  await as(agentA,async()=>{const id=(await checkin()).rows[0].id;expect((await checkin()).rows[0].id).toBe(id);const before=await db.query('select id from field_visits where company_id=$1 and completed_at is not null',[companyA]);expect(before.rows).toHaveLength(0);await expect(db.query("select field_complete($1,$2,'{}')",[companyA,id])).rejects.toThrow('Complete stock');await expect(db.query("select field_shift($1,'out')",[companyA])).rejects.toThrow('Complete the open visit');const report={stock_checked:true,contact_confirmed:true,notes:'Reviewed shelf stock and spoke with the store manager.'};for(let i=0;i<2;i++)await db.query('select field_complete($1,$2,$3)',[companyA,id,report]);await expect(db.query('select field_complete($1,$2,$3)',[companyA,id,{...report,notes:'A different report after completion'}])).rejects.toThrow('immutable');await db.query("select field_shift($1,'out')",[companyA]);});
});
it('enforces supervisor override justification and logs the override without completing a visit',async()=>{
  const aid=await as(adminA,()=>scalar("select field_assign($1,$2,$3,(now() at time zone 'Africa/Lagos')::date) id",[companyA,storeA,agentB]).catch(()=>''));expect(aid).toBe('');
  await as(adminA,()=>expect(db.query('select field_override($1,$2,$3)',[companyA,assignmentA,'short'])).rejects.toThrow('justification'));
  await as(agentB,()=>expect(db.query('select field_override($1,$2,$3)',[companyA,assignmentA,'Unauthorized override attempt'])).rejects.toThrow('Forbidden'));
  const second=await as(adminA,()=>scalar("select field_save_store($1,'Second store','20 Market Street, Lagos',6.51,3.4,null) id",[companyA]));
  const next=await as(adminA,()=>scalar("select field_assign($1,$2,$3,(now() at time zone 'Africa/Lagos')::date) id",[companyA,second,agentA]));
  await as(agentA,()=>db.query("select field_shift($1,'in')",[companyA]));
  const visit=await as(adminA,()=>scalar('select field_override($1,$2,$3) id',[companyA,next,'GPS hardware unavailable, verified attendance by supervisor.']));
  expect((await db.query('select completed_at from field_visits where id=$1',[visit])).rows).toEqual([{completed_at:null}]);
  expect((await db.query("select id from platform_audit where company_id=$1 and action='field.supervisor_override'",[companyA])).rows).toHaveLength(1);
  const report={stock_checked:true,contact_confirmed:true,notes:'Verified inventory with store manager after approved exception.'};
  await as(agentB,()=>expect(db.query('select field_complete($1,$2,$3)',[companyA,visit,report])).rejects.toThrow('Forbidden'));
  await as(agentA,()=>db.query('select field_complete($1,$2,$3)',[companyA,visit,report]));
});
it('expires precise coordinates after 90 days and preserves completion evidence',async()=>{
  await db.query("update field_visits set completed_at=now()-interval '91 days' where company_id=$1 and latitude is not null",[companyA]);
  await as(adminA,()=>expect(db.query('select field_purge_location()')).rejects.toThrow('permission denied'));
  await db.query('select field_purge_location()');
  const r=await db.query<{latitude:number|null;task_report:unknown}>("select latitude,task_report from field_visits where company_id=$1 and completed_at<now()-interval '90 days'",[companyA]);expect(r.rows).toHaveLength(1);expect(r.rows[0].latitude).toBeNull();expect(r.rows[0].task_report).toBeTruthy();
});
it('synchronizes the flagship brand without changing another company',async()=>{
  const flagship='10000000-0000-4000-8000-000000000001';await db.query("update profiles set role='admin' where id=$1",[root]);
  await as(root,()=>db.query("select company_brand($1,'publish',$2,null)",[flagship,{...defaultTheme,name:'Flagship brand'}]));
  expect(await scalar("select config->>'name' id from website_settings where id='published'")).toBe('Flagship brand');
  await as(root,()=>db.query("select change_theme('publish',$1,null)",[{...defaultTheme,name:'Theme Studio brand'}]));
  expect(await scalar("select brand->>'name' id from platform_companies where id=$1",[flagship])).toBe('Theme Studio brand');
  expect(await scalar("select brand->>'name' id from platform_companies where id=$1",[companyA])).toBe('Company A published');
});
it('denies anonymous access and prevents company suspension from being bypassed',async()=>{
  await db.exec('set role anon');try{await expect(db.query('select * from platform_companies')).rejects.toThrow('permission denied');await expect(db.query('select field_shift($1,\'in\')',[companyA])).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}
  await as(root,()=>db.query('select platform_set_active($1,false)',[companyB]),'aal2');await as(adminB,async()=>{expect((await db.query('select id from platform_companies')).rows).toHaveLength(0);await expect(db.query("select field_save_store($1,'Denied store','A denied address',9,7,null)",[companyB])).rejects.toThrow('Forbidden');});
});
