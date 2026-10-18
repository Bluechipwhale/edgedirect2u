// Reviewed GPS grouping and a single explicitly requested salesperson allocation.
const fs=require('node:fs'),crypto=require('node:crypto');
const {plan}=require('./gps-route-planner.cjs');
const company='10000000-0000-4000-8000-000000000001';
const canonical=rows=>rows.map(r=>({id:r.id,latitude:r.latitude,longitude:r.longitude,route:r.route,address:r.address})).sort((a,b)=>a.id.localeCompare(b.id));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const csv=rows=>'\uFEFF'+rows.map(row=>row.map(v=>'"'+(typeof v==='string'&&/^[\s]*[=+@-]/.test(v)?"'"+v:String(v??'')).replace(/"/g,'""')+'"').join(',')).join('\r\n');
function prepare(outlets){const generated=plan(outlets);if(!generated.assigned_route)throw Error('No suitable Ikeja route');return {...generated,id:'gps-'+hash(canonical(outlets)).slice(0,20),snapshot_sha256:hash(canonical(outlets)),before:outlets,planned_at:new Date().toISOString(),method:'GPS distance grouping, minimum 10 / target 25 / maximum 35, maximum pairwise diameter 4 km; nearest-neighbour and 2-opt stop sequence. No road-time or legal-boundary claim.'};}
function exportsFor(p){fs.mkdirSync('artifacts',{recursive:true});
 fs.writeFileSync('artifacts/gps-route-summary.csv',csv([['Route','Outlets','Diameter km (straight line)','Ordered path km (straight line)','Shared-coordinate review','Assigned to Timothy'],...p.routes.map(r=>[r.name,r.count,Number(r.diameter_km.toFixed(3)),Number(r.straight_line_path_km.toFixed(3)),r.shared_coordinate_outlets,r.name===p.assigned_route?'Yes':'Unassigned'])]));
 fs.writeFileSync('artifacts/gps-route-stops.csv',csv([['Route','Stop','Outlet ID','Legacy customer ID','Outlet name','Address','Latitude','Longitude','Location review'],...p.routes.flatMap(r=>r.stops.map(s=>[r.name,s.sequence,s.id,s.legacy_customer_id,s.name,s.address,s.latitude,s.longitude,s.location_review_reason]))]));
 fs.writeFileSync('artifacts/gps-route-review.csv',csv([['Outlet ID','Legacy customer ID','Outlet name','Address','Latitude','Longitude','Reason'],...p.review.map(s=>[s.id,s.legacy_customer_id,s.name,s.address,s.latitude,s.longitude,s.reason])]));
}
async function main(){
 if(!process.argv.includes('--apply')){const prepared=prepare(JSON.parse(fs.readFileSync('.data/route-outlets.json','utf8')));fs.writeFileSync('.data/gps-route-plan.json',JSON.stringify(prepared));exportsFor(prepared);console.log(JSON.stringify({plan:prepared.id,summary:prepared.summary,assigned_route:prepared.assigned_route,method:prepared.method}));return;}
 const p=JSON.parse(fs.readFileSync('.data/gps-route-plan.json','utf8')),expected=Number(process.argv.find(v=>v.startsWith('--expect-routed='))?.slice(16)),email=process.argv.find(v=>v.startsWith('--assign-email='))?.slice(15).toLowerCase();
 if(expected!==p.summary.routed||p.summary.minimum<10||p.summary.outlets!==3456||!email)throw Error('Explicit reviewed count and salesperson email required');
 const rebuilt=prepare(p.before);if(rebuilt.id!==p.id||hash(rebuilt.routes)!==hash(p.routes)||hash(rebuilt.review)!==hash(p.review))throw Error('Route plan changed; regenerate for review');
 require('@next/env').loadEnvConfig(process.cwd());const {Client}=require('pg');
 const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
 try{await db.connect();await db.query('begin');try{
  await db.query("select pg_advisory_xact_lock(hashtext('edge-gps-routes'))");
  const owner=(await db.query("select p.id from profiles p join auth.users u on p.id=u.id where p.role='admin' and lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null")).rows[0];if(!owner)throw Error('Confirmed owner required');
  const agent=(await db.query("select m.user_id from platform_memberships m join auth.users u on u.id=m.user_id where m.company_id=$1 and m.active and m.role='field_agent' and lower(u.email)=$2 and u.email_confirmed_at is not null",[company,email])).rows[0];if(!agent)throw Error('Confirmed active salesperson required');
  const current=(await db.query('select id,address,latitude,longitude,route,route_sequence,routing_batch,location_review_reason from field_stores where company_id=$1 for update',[company])).rows;
  if(current.length===3456&&current.every(r=>r.routing_batch===p.id)){await db.query('rollback');console.log(JSON.stringify({already_applied:p.id,changes:0}));return;}
  if(hash(canonical(current))!==p.snapshot_sha256)throw Error('Outlet addresses, routes or GPS changed; generate a fresh plan');
  if((await db.query('select 1 from field_visits where company_id=$1 and completed_at is null limit 1',[company])).rowCount)throw Error('A store visit is in progress; finish it before replanning');
  if((await db.query('select 1 from field_route_access where company_id=$1 and active limit 1',[company])).rowCount)throw Error('Existing active route allocations require individual reconciliation');
  const updates=p.routes.flatMap(r=>r.stops.map(s=>({id:s.id,route:r.name,sequence:s.sequence,review:s.location_review_reason})));
  updates.push(...p.review.map(r=>({id:r.id,route:'',sequence:null,review:r.reason})));
  const result=await db.query(`update field_stores s set route=x.route,route_sequence=x.sequence,routing_batch=$2,location_review_reason=x.review from jsonb_to_recordset($1::jsonb) x(id uuid,route text,sequence integer,review text) where s.company_id=$3 and s.id=x.id returning s.id`,[JSON.stringify(updates),p.id,company]);if(result.rowCount!==3456)throw Error('Incomplete route update');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.id]);await db.query('select field_set_route($1,$2,$3,true)',[company,p.assigned_route,agent.user_id]);
  // Materialize today's plan now so the owner sees the assignment immediately.
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[agent.user_id]);await db.query('select field_prepare_day($1)',[company]);
  const daily=(await db.query("select field_daily_report($1,(now() at time zone 'Africa/Lagos')::date,(now() at time zone 'Africa/Lagos')::date) report",[company])).rows[0].report;
  const route=p.routes.find(r=>r.name===p.assigned_route);if(daily.summary.assigned!==route.count)throw Error('Assigned daily visit count does not match the chosen route');
  await db.query("insert into platform_audit(company_id,actor,action,detail) values($1,$2,'field.gps_routes.applied',$3)",[company,owner.id,{plan_id:p.id,...p.summary,assigned_route:p.assigned_route,assigned_agent:agent.user_id,assigned_stops:route.count,method:p.method,before:current}]);
  await db.query('commit');console.log(JSON.stringify({applied:p.id,...p.summary,assigned_route:p.assigned_route,assigned_today:daily.summary.assigned,visited_today:daily.summary.visited,gps_coordinates_changed:0}));
 }catch(e){await db.query('rollback');throw e;}}finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('GPS route application failed: '+e.message);process.exitCode=1;});
module.exports={main,prepare};
