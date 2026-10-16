// Owner-authorized migration of saved outlet data. No passwords or invitations.
const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');const {Client}=require('pg');
const sha=v=>createHash('sha256').update(v).digest('hex');
const clean=(v,n)=>String(v??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,n);
function normalize(customers,locations){
 if(!Array.isArray(customers)||!Array.isArray(locations))throw Error('Verified customer and location arrays required');
 const byId=new Map();for(const g of locations){const id=clean(g.legacyId,100);if(byId.has(id))throw Error('Duplicate source location ID');byId.set(id,g);}
 const seen=new Set();const rows=customers.map(c=>{const id=clean(c.legacyId,100);if(!/^[1-9][0-9]*$/.test(id)||seen.has(id)||!byId.has(id))throw Error('Missing or duplicate customer location evidence');seen.add(id);const g=byId.get(id);
 const supplied=clean(g.latitude,100)!==''&&clean(g.longitude,100)!=='';const lat=Number(g.latitude),lng=Number(g.longitude);const valid=supplied&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(lat===0&&lng===0);
 // Out-of-country coordinates are retained in private source evidence for review,
 // rather than activating an implausible Nigerian customer geofence.
 const local=valid&&lat>=4&&lat<=14&&lng>=2&&lng<=15;
 const route=clean(c.route,250).split(',')[0].trim();
 const address={house_number:clean(g.houseNumber,100),street:clean(g.street,300),country:clean(g.country,120),state:clean(g.state,120),local_government:clean(g.localGovernment,120),legacy_route:clean(c.route,250)};
 const street=[address.house_number,address.street].filter(Boolean).join(' ');const area=[address.local_government,address.state].filter(Boolean).join(', ')||clean(c.route,250).replace(/^,\s*/,'');
 return {legacy_id:id,name:clean(c.name,100)||`Legacy customer ${id}`,phone:clean(c.phone,40),route,address:clean(street?[street,area].filter(Boolean).join(', '):`Address not recorded${area?'; '+area:''}`,500),latitude:local?lat:null,longitude:local?lng:null,location_source:local?'legacy':'missing',source_address:address,location_review:supplied&&!local?'Source coordinates need review':!supplied?'No saved coordinate pair':null};});
 if(byId.size!==seen.size)throw Error('Location evidence contains unmatched customers');return rows;
}
async function main(){const read=(name)=>{const p=fs.realpathSync(path.join('.data',name));if(!p.startsWith(fs.realpathSync('.data')+path.sep))throw Error('Private evidence must remain in .data');return fs.readFileSync(p);};
 const customers=read('legacy-customers.json'),locations=read('legacy-locations.json');const c=JSON.parse(customers),g=JSON.parse(locations);const rows=normalize(Array.isArray(c)?c:c.records,g.records);
 const expected=Number(process.argv.find(x=>x.startsWith('--expect='))?.split('=')[1]);if(!expected||rows.length!==expected||g.pages?.length!==Math.ceil(expected/50))throw Error('Full source count and pagination evidence required');
 const evidence=sha(locations);const counts={customers:rows.length,saved_gps:rows.filter(r=>r.latitude!==null).length,missing_gps:rows.filter(r=>r.latitude===null).length,coordinates_to_review:rows.filter(r=>r.location_review==='Source coordinates need review').length,named_route:rows.filter(r=>r.route).length};console.log(JSON.stringify({...counts,source_sha256:evidence,mode:process.argv.includes('--apply')?'apply':'plan'}));if(!process.argv.includes('--apply'))return;
 require('@next/env').loadEnvConfig(process.cwd());const url=new URL(process.env.DATABASE_URL),host=url.hostname;if(process.env.DATABASE_HOST_ADDRESS)url.hostname=process.env.DATABASE_HOST_ADDRESS.includes(':')?'['+process.env.DATABASE_HOST_ADDRESS+']':process.env.DATABASE_HOST_ADDRESS;
 const db=new Client({connectionString:url.toString(),connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,servername:host,...(process.env.DATABASE_CA_PATH?{ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}:{})}});
 try{await db.connect();await db.query('begin');await db.query("select pg_advisory_xact_lock(hashtext('edge-field-customer-import'))");const company='10000000-0000-4000-8000-000000000001';const owner=(await db.query("select p.id from profiles p join auth.users u on u.id=p.id where lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null and p.role='admin'")).rows[0];if(!owner)throw Error('Confirmed owner administrator required');
 const present=(await db.query('select count(*)::int n from legacy_customers where source_id=any($1::text[])',[rows.map(r=>r.legacy_id)])).rows[0].n;if(present!==rows.length)throw Error('Import contact records first');let created=0;
 for(let offset=0;offset<rows.length;offset+=200){const payload=JSON.stringify(rows.slice(offset,offset+200));const result=await db.query(`insert into field_stores(company_id,legacy_customer_id,name,address,phone,route,latitude,longitude,location_source,location_updated_at)
 select $1::uuid,x.legacy_id,x.name,x.address,x.phone,x.route,x.latitude,x.longitude,x.location_source,case when x.latitude is not null then now() end from jsonb_to_recordset($2::jsonb) x(legacy_id text,name text,address text,phone text,route text,latitude double precision,longitude double precision,location_source text)
 on conflict(company_id,legacy_customer_id) do nothing returning id`,[company,payload]);created+=result.rowCount;
 await db.query(`update legacy_customers c set address=c.address||x.source_address,details=c.details||jsonb_build_object('location_source_sha256',$2::text,'location_review',x.location_review,'saved_location_available',x.latitude is not null)
 from jsonb_to_recordset($1::jsonb) x(legacy_id text,source_address jsonb,location_review text,latitude double precision) where c.source_id=x.legacy_id`,[payload,evidence]);}
 const checked=(await db.query('select count(*)::int n,count(latitude)::int gps from field_stores where company_id=$1 and legacy_customer_id=any($2::text[])',[company,rows.map(r=>r.legacy_id)])).rows[0];if(checked.n!==rows.length)throw Error('Imported outlet count mismatch');
 await db.query("update platform_companies set allow_web_checkin=true where id=$1",[company]);await db.query("insert into platform_audit(company_id,actor,action,detail) values($1,$2,'field.customers.import',$3)",[company,owner.id,{...counts,created,source_sha256:evidence,web_checkin_enabled:true,existing_outlets_preserved:true}]);await db.query('commit');console.log(JSON.stringify({imported:checked.n,saved_gps:checked.gps,created,auth_users_created:0,emails_sent:0}));
 }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('Outlet import failed: '+e.message);process.exitCode=1;});module.exports={normalize};
