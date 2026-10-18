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
it('reports every daily assignment with exact pagination, visit states and company/agent isolation',async()=>{
 await db.query('begin');try{
  const day='2026-10-18';
  await db.query(`insert into field_stores(company_id,name,address,route,route_sequence,routing_batch) select $1,'Report outlet '||n,'Report address','Report test',n,'test-batch' from generate_series(1,205) n`,[companyA]);
  await as(adminA,async()=>{const result=await db.query<{d:{rows:{route_sequence:number}[]}}>("select field_store_directory($1,'','Report test','all',2) d",[companyA]);expect(result.rows[0].d.rows[0].route_sequence).toBe(41);expect(result.rows[0].d.rows.at(-1)?.route_sequence).toBe(80);});
  await db.query(`insert into field_assignments(company_id,store_id,agent_id,visit_date) select company_id,id,$2,$3 from field_stores where company_id=$1 and route='Report test'`,[companyA,agentA,day]);
  await db.query(`insert into field_visits(company_id,assignment_id,agent_id,completed_at) select company_id,id,agent_id,now() from field_assignments where company_id=$1 and visit_date=$2 and store_id in(select id from field_stores where route='Report test') order by id limit 3`,[companyA,day]);
  await db.query(`insert into field_visits(company_id,assignment_id,agent_id) select a.company_id,a.id,a.agent_id from field_assignments a where a.company_id=$1 and a.visit_date=$2 and not exists(select 1 from field_visits v where v.assignment_id=a.id) order by a.id limit 1`,[companyA,day]);
  const report=async(who:string,c=companyA,agent:string|null=agentA,page=1)=>as(who,async()=>{const result=await db.query<{d:{count:number;summary:{assigned:number;visited:number;completed:number;remaining:number;in_progress:number};rows:{assignment_id:string;agent_id:string}[]}}>('select field_daily_report($1,$2,$2,$3,$4) d',[c,day,agent,page]);return result.rows[0].d;});
  const first=await report(agentA),second=await report(agentA,companyA,null,2),third=await report(adminA,companyA,agentA,3);
  expect(first.count).toBeGreaterThanOrEqual(205);expect(first.summary.assigned).toBe(first.count);expect(first.summary.visited).toBe(4);expect(first.summary.completed).toBe(3);expect(first.summary.in_progress).toBe(1);expect(first.summary.remaining).toBe(first.count-4);
  expect(first.rows).toHaveLength(100);expect(second.rows).toHaveLength(100);expect(third.rows).toHaveLength(first.count-200);expect(new Set([...first.rows,...second.rows,...third.rows].map(r=>r.assignment_id)).size).toBe(first.count);expect(first.rows.every(r=>r.agent_id===agentA)).toBe(true);
  const flagship='10000000-0000-4000-8000-000000000001';
  await db.query("insert into platform_memberships(company_id,user_id,role) values($1,$2,'field_agent') on conflict(company_id,user_id) do update set role='field_agent',active=true",[flagship,agentA]);
  await db.query("insert into categories(id,name,image) values('report-category','Test','')");
  await db.query("insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,image,description) values('report-product','report-product','Test product','report-category','Test','edge','Test',100,'','Test')");
  await db.query("insert into business_van_sales(id,seller_id,product_id,quantity,unit_price_kobo,note,created_at,cash_confirmed_at) values(gen_random_uuid(),$1,'report-product',2,100,'Test','2026-10-17T23:30:00Z',now()),(gen_random_uuid(),$1,'report-product',9,100,'Test','2026-10-18T23:30:00Z',null)",[agentA]);
  await as(agentA,async()=>{const result=await db.query<{d:{sales:{amount_kobo:number;units:number;cash_confirmed_kobo:number}}}>("select field_daily_report($1,'2026-10-18','2026-10-18') d",[flagship]);expect(result.rows[0].d.sales).toMatchObject({amount_kobo:200,units:2,cash_confirmed_kobo:200});});
 }finally{await db.query('rollback');}
 for(const [who,scope,agent] of [[agentA,companyA,agentB],[agentB,companyA,null],[adminB,companyA,null],[outsider,companyA,null]])await as(who!,()=>expect(db.query("select field_daily_report($1,'2026-10-18','2026-10-18',$2)",[scope,agent])).rejects.toThrow('Forbidden'));
 await as(agentA,()=>expect(db.query('select * from legacy_catalogue_source')).rejects.toThrow('permission denied'));
 await db.exec('set role anon');try{await expect(db.query("select field_daily_report($1,'2026-10-18','2026-10-18')",[companyA])).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}
});
it('clears stale route ordering when a manager changes the route or saved GPS',async()=>{
 await db.query('begin');try{
  await db.query("update field_stores set route_sequence=3,routing_batch='test' where id=$1",[storeA]);
  await db.query("update field_stores set route='Manager changed route' where id=$1",[storeA]);
  expect((await db.query('select route_sequence,routing_batch from field_stores where id=$1',[storeA])).rows[0]).toEqual({route_sequence:null,routing_batch:null});
 }finally{await db.query('rollback');}
});
it('paginates the complete customer register and scopes recurring routes to their salesperson',async()=>{
 await db.query(`insert into field_stores(company_id,name,address,latitude,longitude,route,location_source) select $1,'Route customer '||n,'Verified source address',case when n%2=0 then 6.5 end,case when n%2=0 then 3.4 end,'Recurring test','missing' from generate_series(1,241) n`,[companyA]);
 await as(adminA,()=>db.query("select field_set_route($1,'Recurring test',$2,true)",[companyA,agentA]));
 await as(adminA,async()=>{const result=await db.query<{d:{count:number;rows:unknown[]}}>("select field_store_directory($1,'','Recurring test','all',7) d",[companyA]);expect(result.rows[0].d.count).toBe(241);expect(result.rows[0].d.rows).toHaveLength(1);});
 await as(agentA,async()=>{const r=await db.query<{d:{total:number;count:number}}>("select field_store_directory($1,'','Recurring test','ready',1) d",[companyA]);expect(r.rows[0].d.count).toBe(120);expect(r.rows[0].d.total).toBe(242);await db.query('select field_prepare_day($1)',[companyA]);await db.query('select field_prepare_day($1)',[companyA]);});
 expect(Number((await db.query<{n:number}>('select count(*) n from field_assignments a join field_stores s on s.id=a.store_id where a.company_id=$1 and s.route=$2',[companyA,'Recurring test'])).rows[0].n)).toBe(241);
 const moved=await scalar("select id from field_stores where company_id=$1 and route='Recurring test' limit 1",[companyA]);
 await db.query("update field_stores set route='Moved test' where id=$1",[moved]);
 expect(Number((await db.query<{n:number}>('select count(*) n from field_assignments where store_id=$1',[moved])).rows[0].n)).toBe(0);
 await db.query("update field_stores set route='Recurring test' where id=$1",[moved]);await as(agentA,()=>db.query('select field_prepare_day($1)',[companyA]));
 await as(adminA,()=>db.query("select field_assign($1,$2,$3,(now() at time zone 'Africa/Lagos')::date)",[companyA,moved,agentA]));
 await as(adminA,()=>db.query("select field_set_route($1,'Recurring test',$2,false)",[companyA,agentA]));
 expect(Number((await db.query<{n:number}>('select count(*) n from field_assignments where company_id=$1 and source_route is not null',[companyA])).rows[0].n)).toBe(0);
 const revoked=await scalar("select id from field_stores where company_id=$1 and route='Recurring test' and id<>$2 limit 1",[companyA,moved]);
 await as(agentA,()=>expect(db.query('select field_start_visit($1,$2,6.5,3.4,5,now())',[companyA,revoked])).rejects.toThrow('Forbidden'));
 expect((await db.query('select id from field_assignments where store_id=$1',[moved])).rows).toHaveLength(1);
 expect((await db.query('select id from field_assignments where id=$1',[assignmentA])).rows).toHaveLength(1);
 await as(agentB,()=>expect(db.query('select field_store_directory($1)',[companyA])).rejects.toThrow('Forbidden'));
 await as(outsider,()=>expect(db.query('select * from field_route_access')).rejects.toThrow('permission denied'));
 // Avoid affecting the independent schedule/geofence tests below.
 await db.query("delete from field_assignments where company_id=$1 and store_id in(select id from field_stores where company_id=$1 and route='Recurring test')",[companyA]);
 await db.query("delete from field_route_access where company_id=$1 and route='Recurring test'",[companyA]);await db.query("delete from field_stores where company_id=$1 and route='Recurring test'",[companyA]);
});
it('requires location approval and rolls back automatic clock-in when verification fails',async()=>{
 const sid=await as(adminB,()=>scalar("select field_save_outlet($1,null,'Missing GPS store','Address pending verification','','Capture route',null,null) id",[companyB]));
 await as(adminB,()=>db.query("select field_set_route($1,'Capture route',$2,true)",[companyB,agentB]));
 await as(adminB,()=>db.query('select company_field_policy($1,100,30,true)',[companyB]));
 await as(agentB,()=>expect(db.query('select field_start_visit($1,$2,6.5,3.4,5,now())',[companyB,sid])).rejects.toThrow('location needs'));
 expect((await db.query('select id from field_shifts where company_id=$1',[companyB])).rows).toHaveLength(0);
 const proposal=await as(agentB,()=>scalar('select field_propose_location($1,$2,6.5,3.4,5,now()) id',[companyB,sid]));
 expect((await db.query<{latitude:number|null}>('select latitude from field_stores where id=$1',[sid])).rows[0].latitude).toBeNull();
 await as(adminA,()=>expect(db.query('select field_review_location($1,$2,true)',[companyB,proposal])).rejects.toThrow('Forbidden'));
 await as(adminB,()=>db.query('select field_review_location($1,$2,true)',[companyB,proposal]));
 await as(adminB,()=>db.query('select company_field_policy($1,100,30,true)',[companyB]));
 await as(agentB,()=>expect(db.query('select field_start_visit($1,$2,7,3.4,5,now())',[companyB,sid])).rejects.toThrow('geofence'));
 expect((await db.query('select id from field_shifts where company_id=$1',[companyB])).rows).toHaveLength(0);
 await as(agentA,()=>expect(db.query('select field_start_visit($1,$2,6.5,3.4,5,now())',[companyB,sid])).rejects.toThrow('Forbidden'));
 await as(agentB,async()=>{const v=await scalar('select field_start_visit($1,$2,6.5,3.4,5,now()) id',[companyB,sid]);expect(await scalar('select field_start_visit($1,$2,6.5,3.4,5,now()) id',[companyB,sid])).toBe(v);await expect(db.query('select field_checkin_verified($1,$2,6.5,3.4,5,now())',[companyB,assignmentA])).rejects.toThrow('permission denied');});
 expect((await db.query('select id from field_shifts where company_id=$1',[companyB])).rows).toHaveLength(1);
 // Restore this fixture for independent company isolation tests.
 await db.query('delete from field_visits where company_id=$1',[companyB]);await db.query('delete from field_assignments where company_id=$1',[companyB]);await db.query('delete from field_location_requests where company_id=$1',[companyB]);await db.query('delete from field_route_access where company_id=$1',[companyB]);await db.query('delete from field_shifts where company_id=$1',[companyB]);await db.query('delete from field_stores where id=$1',[sid]);
});
it('registers staff only through approved confirmed emails, then revokes membership immediately',async()=>{
 const newcomer='21000000-0000-4000-8000-000000000001';
 await as(adminA,()=>db.query("select company_prepare_staff($1,'new-sales@example.com','New Salesperson','','van_sales',null)",[companyA]));
 await db.query("insert into auth.users values($1,'new-sales@example.com',null)",[newcomer]);
 await as(newcomer,()=>db.query('select company_claim_staff()'));expect((await db.query('select user_id from platform_memberships where user_id=$1 and company_id=$2',[newcomer,companyA])).rows).toHaveLength(0);
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[newcomer]);await as(newcomer,()=>db.query('select company_claim_staff()'));
 expect((await db.query('select role,label,active from platform_memberships where user_id=$1 and company_id=$2',[newcomer,companyA])).rows).toEqual([{role:'field_agent',label:'New Salesperson',active:true}]);
 await as(adminA,()=>expect(db.query("select company_prepare_staff($1,'person1@example.com','Owner','','van_sales',null)",[companyA])).rejects.toThrow('protected'));
 await as(adminA,()=>expect(db.query("select company_prepare_staff($1,'new-sales@example.com','New Salesperson','','it_manager',null)",[companyA])).rejects.toThrow('flagship'));
 await as(adminA,()=>db.query("select company_staff_active($1,'new-sales@example.com',false)",[companyA]));await as(newcomer,async()=>{await db.query('select company_claim_staff()');await expect(db.query('select field_store_directory($1)',[companyA])).rejects.toThrow('Forbidden');});
 await as(adminA,()=>db.query("select company_staff_active($1,'new-sales@example.com',true)",[companyA]));await as(newcomer,()=>db.query('select company_claim_staff()'));
 expect((await db.query<{active:boolean}>('select active from platform_memberships where user_id=$1 and company_id=$2',[newcomer,companyA])).rows[0].active).toBe(true);
 await db.query('delete from company_staff_invitations where email=$1',['new-sales@example.com']);await db.query('delete from platform_memberships where user_id=$1',[newcomer]);
});
it('separates platform owners from company administrators and requires MFA',async()=>{
  await as(root,async()=>{expect(await scalar('select platform_is_admin()::text id')).toBe('false');await expect(db.query('select platform_set_active($1,false)',[companyB])).rejects.toThrow('verified MFA');});
  await as(adminA,async()=>{expect(await scalar('select platform_is_admin()::text id')).toBe('false');await expect(db.query('select platform_set_active($1,false)',[companyB])).rejects.toThrow('verified MFA');},'aal2');
  await as(root,async()=>expect(await scalar('select platform_is_admin()::text id')).toBe('true'),'aal2');
});
it('isolates company rows, memberships, stores, roles and all direct writes',async()=>{
  await as(adminA,async()=>{const companies=await db.query('select id from platform_companies');expect(companies.rows).toEqual([{id:companyA}]);expect((await db.query('select id from field_stores')).rows).toEqual([{id:storeA}]);expect((await db.query('select user_id from platform_memberships where company_id=$1',[companyB])).rows).toEqual([]);await expect(db.query("insert into platform_memberships(company_id,user_id,role) values($1,$2,'company_admin')",[companyB,adminA])).rejects.toThrow();await expect(db.query("select company_set_member($1,'person5@example.com','company_admin',true)",[companyB])).rejects.toThrow('Forbidden');});
  await as(outsider,async()=>{expect((await db.query('select * from field_visits')).rows).toEqual([]);expect((await db.query('select * from platform_companies')).rows).toEqual([]);});
});
it('lets only verified platform owners change company addresses and audits the selected company',async()=>{
  const address='15 Emmanuel Olorunfemi, off College Road, Ogba, Lagos, Nigeria';
  expect(await scalar("select address id from platform_companies where id='10000000-0000-4000-8000-000000000001'")).toBe(address);
  await db.exec('set role anon');try{await expect(db.query('select platform_set_company_address($1,$2)',[companyA,address])).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}
  for(const user of [root,adminA,agentA,outsider])await as(user,()=>expect(db.query('select platform_set_company_address($1,$2)',[companyA,address])).rejects.toThrow('verified MFA'));
  await as(adminA,()=>expect(db.query('select platform_set_company_address($1,$2)',[companyB,address])).rejects.toThrow('verified MFA'),'aal2');
  await as(root,async()=>{
    await expect(db.query('select platform_set_company_address($1,$2)',[companyA,'x'.repeat(501)])).rejects.toThrow('500 characters');
    await expect(db.query('select platform_set_company_address($1,null)',[companyA])).rejects.toThrow('500 characters');
    await expect(db.query('select platform_set_company_address($1,$2)',[outsider,address])).rejects.toThrow('Company unavailable');
    await db.query('select platform_set_company_address($1,$2)',[companyA,`  ${address}  `]);
  },'aal2');
  expect(await scalar('select address id from platform_companies where id=$1',[companyA])).toBe(address);
  expect(await scalar('select address id from platform_companies where id=$1',[companyB])).toBe('');
  expect((await db.query("select actor,detail from platform_audit where company_id=$1 and action='company.address'",[companyA])).rows).toEqual([{actor:root,detail:{field:'address'}}]);
  await as(adminA,()=>expect(db.query('update platform_companies set address=$2 where id=$1',[companyA,'Unauthorized address'])).rejects.toThrow('permission denied'));
  await as(root,()=>db.query("select platform_set_company_address($1,'')",[companyA]),'aal2');
});
it('discovers only active authorized workspaces and scopes aggregate reports',async()=>{
  await as(agentA,async()=>{expect((await db.query('select slug from my_company_workspaces()')).rows).toEqual([{slug:'company-a'}]);expect((await db.query<{metrics:{planned:number;completed:number}}>('select company_metrics($1) metrics',[companyA])).rows[0].metrics).toMatchObject({planned:1,completed:0});await expect(db.query('select company_metrics($1)',[companyB])).rejects.toThrow('Forbidden');});
  await as(outsider,async()=>expect((await db.query('select * from my_company_workspaces()')).rows).toEqual([]));
});
it('does not expose internal entitlement checks to direct client calls',async()=>{
  await as(outsider,()=>expect(db.query('select field_enabled($1)',[companyA])).rejects.toThrow('permission denied'));
  await as(adminA,()=>expect(db.query('select field_enabled($1)',[companyA])).rejects.toThrow('permission denied'));
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
it('atomically verifies flagship clock-in at 50m, rejects bypasses and excludes test attendance from metrics',async()=>{
 const flagship='10000000-0000-4000-8000-000000000001';
 await db.query("insert into platform_memberships(company_id,user_id,role) values($1,$2,'field_agent'),($1,$3,'company_admin') on conflict(company_id,user_id) do update set role=excluded.role,active=true",[flagship,agentA,adminA]);
 await db.query('update platform_companies set allow_web_checkin=true where id=$1',[flagship]);
 const sid=await scalar("insert into field_stores(company_id,name,address,latitude,longitude,radius_metres,is_test) values($1,'GPS test outlet','Isolated test fixture',6.5,3.4,1000,true) returning id",[flagship]);
 const aid=await scalar("insert into field_assignments(company_id,store_id,agent_id,visit_date) values($1,$2,$3,(now() at time zone 'Africa/Lagos')::date) returning id",[flagship,sid,agentA]);
 const start=(lat:number,accuracy:number)=>as(agentA,()=>scalar('select field_start_visit($1,$2,$3,3.4,$4,now()) id',[flagship,sid,lat,accuracy]));
 try{
  await as(adminA,()=>expect(db.query('select company_field_policy($1,100,30,true)',[flagship])).rejects.toThrow('maximum'));
  await as(adminA,()=>expect(db.query("select field_override($1,$2,'Remote test attendance should be blocked')",[flagship,aid])).rejects.toThrow('GPS verification'));
  await as(agentA,()=>expect(db.query("select field_shift($1,'in')",[flagship])).rejects.toThrow('use GPS'));
  await expect(start(6.5006,1)).rejects.toThrow('50 metre geofence');
  await expect(start(6.5004,10)).rejects.toThrow('uncertainty');
  expect((await db.query('select id from field_shifts where company_id=$1 and agent_id=$2',[flagship,agentA])).rows).toHaveLength(0);
  const visit=await start(6.5003,5);expect(await start(6.5003,5)).toBe(visit);
  await expect(start(6.5006,1)).rejects.toThrow('geofence');
  expect((await db.query('select test_only,ended_at from field_shifts where company_id=$1 and agent_id=$2',[flagship,agentA])).rows).toEqual([{test_only:true,ended_at:null}]);
  await as(agentA,async()=>{
   const report=(await db.query<{d:{count:number;summary:{visited:number}}}>('select field_daily_report($1,(now() at time zone \'Africa/Lagos\')::date,(now() at time zone \'Africa/Lagos\')::date) d',[flagship])).rows[0].d;
   expect(report.count).toBe(0);expect(report.summary.visited).toBe(0);
   expect((await db.query<{d:{planned:number;completed:number}}>('select company_metrics($1) d',[flagship])).rows[0].d).toMatchObject({planned:0,completed:0});
   expect((await db.query<{d:{total:number}}>('select field_store_directory($1) d',[flagship])).rows[0].d.total).toBe(0);
  });
  await as(agentB,()=>expect(db.query('select field_finish_test($1,$2)',[flagship,visit])).rejects.toThrow('Forbidden'));
  await as(agentA,()=>db.query('select field_finish_test($1,$2)',[flagship,visit]));
  expect((await db.query<{ended_at:string|null}>('select ended_at from field_shifts where company_id=$1 and agent_id=$2',[flagship,agentA])).rows[0].ended_at).toBeTruthy();
  expect((await db.query<{task_report:unknown}>('select task_report from field_visits where id=$1',[visit])).rows[0].task_report).toMatchObject({test:true});
 }finally{
  await db.query('delete from field_visits where company_id=$1 and agent_id=$2',[flagship,agentA]);await db.query('delete from field_assignments where id=$1',[aid]);await db.query('delete from field_stores where id=$1',[sid]);await db.query('delete from field_shifts where company_id=$1 and agent_id=$2',[flagship,agentA]);await db.query("update platform_memberships set role='customer' where company_id=$1 and user_id in($2,$3)",[flagship,agentA,adminA]);
 }
});
it('requires explicit web-location policy and rejects unverified standalone clock-in',async()=>{
  await as(agentA,async()=>{await expect(checkin()).rejects.toThrow('disabled');await expect(db.query("select field_shift($1,'in')",[companyA])).rejects.toThrow('use GPS');});
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
  await db.query('insert into field_shifts(company_id,agent_id) values($1,$2)',[companyA,agentA]);
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
it('keeps today’s work ahead of a full history window',async()=>{
  await db.query("insert into field_stores(company_id,name,address,latitude,longitude) select $1,'History store '||i,'A verified historical store',6.5,3.4 from generate_series(1,205) i",[companyA]);
  await db.query("insert into field_assignments(company_id,store_id,agent_id,visit_date) select company_id,id,$2,(now() at time zone 'Africa/Lagos')::date-1 from field_stores where company_id=$1 and name like 'History store %'",[companyA,agentA]);
  await as(agentA,async()=>{const r=await db.query<{visit_date:string}>('select visit_date::text from field_schedule($1)',[companyA]);expect(r.rows).toHaveLength(200);expect(r.rows[0].visit_date).toBe(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));expect((await db.query('select * from field_schedule($1)',[companyB])).rows).toHaveLength(0);});
});
