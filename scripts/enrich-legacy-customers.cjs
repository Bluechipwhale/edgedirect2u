// Owner-authorized, private-data maintenance. Reads the original export without
// executing SQL; retains existing sign-ins, corrected locations and audit history.
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {normalize:oldOutlets}=require('./import-field-customers.cjs');
const clean=(v,n=500)=>String(v??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,n);
const localGps=r=>r&&clean(r.latitude)&&clean(r.longitude)&&Number(r.latitude)>=4&&Number(r.latitude)<=14&&Number(r.longitude)>=2&&Number(r.longitude)<=15;

function enrich(parsed,contacts,locations){
  const users=parsed.tables.users,shipping=parsed.tables.shipping_addresses;
  if(!Array.isArray(users)||!Array.isArray(shipping)||!Array.isArray(contacts))throw Error('Source tables missing');
  const original=new Map(oldOutlets(contacts,locations).map(r=>[r.legacy_id,r]));
  const oldContacts=new Map(contacts.map(r=>[String(r.legacyId),r]));
  const cityNames=new Map((parsed.tables.st_local_govt||[]).map(r=>[r.id_no,r.local_govt]));
  const cityName=v=>/^\d+$/.test(clean(v))?clean(cityNames.get(clean(v)),120):clean(v,120);
  if(new Set(users.map(r=>r.id)).size!==users.length||users.length!==original.size)throw Error('Full source ID count mismatch');
  const byCustomer=new Map();
  for(const address of shipping){if(!original.has(address.customer_id)||address.is_billing==='1')continue;
    const rows=byCustomer.get(address.customer_id)||[];rows.push(address);byCustomer.set(address.customer_id,rows);}
  return users.map(user=>{
    const prior=original.get(user.id),contact=oldContacts.get(user.id);if(!prior||!contact)throw Error('Unmatched source customer');
    const first=clean(user.f_name,160),last=clean(user.l_name,160);
    const name=clean([first,last].filter(Boolean).join(' ')||user.name,160)||clean(contact.name,160);
    const addresses=(byCustomer.get(user.id)||[]).sort((a,b)=>Number(b.is_verified==='YES')-Number(a.is_verified==='YES')||String(b.updated_at||'').localeCompare(String(a.updated_at||''))||Number(b.id)-Number(a.id));
    const location=addresses.find(localGps);
    // Never replace an existing saved geofence from the earlier source. A newly
    // recovered address contributes GPS only where no usable pair was recorded.
    const latitude=prior.latitude??(location?Number(location.latitude):null);
    const longitude=prior.longitude??(location?Number(location.longitude):null);
    const preferred=addresses.find(r=>clean(r.address));
    const street=clean(user.street_address)||clean(preferred?.address)||clean(prior.source_address.street);
    const city=cityName(user.city)||cityName(preferred?.city)||clean(prior.source_address.local_government,120);
    const state=clean(user.state,120)||clean(preferred?.state,120)||clean(prior.source_address.state,120);
    const displayAddress=clean([street,city,state].filter(Boolean).join(', '))||prior.address;
    return {source_id:user.id,first_name:first||name,last_name:first?last:'',name,latitude,longitude,
      address:{...prior.source_address,street,city,state},display_address:displayAddress,
      previous_name:prior.name,previous_address:prior.address,previous_latitude:prior.latitude,previous_longitude:prior.longitude,
      recovered_gps:prior.latitude===null&&latitude!==null,shipping_source_id:location?.id||null};
  });
}

async function main(){
  const parsed=JSON.parse(fs.readFileSync('.data/legacy-server-parsed.json','utf8'));
  const actual=createHash('sha256').update(fs.readFileSync('.data/legacy-server.sql.gz')).digest('hex');
  if(parsed.source_sha256!==actual)throw Error('Original export checksum mismatch');
  const contacts=JSON.parse(fs.readFileSync('.data/legacy-customers.json','utf8'));
  const locations=JSON.parse(fs.readFileSync('.data/legacy-locations.json','utf8')).records;
  const rows=enrich(parsed,contacts,locations);
  const expected=Number(process.argv.find(x=>x.startsWith('--expect='))?.slice(9));
  if(expected!==rows.length)throw Error('Explicit full --expect count is required');
  const stats={customers:rows.length,full_names:rows.filter(r=>r.name&&r.name!==r.previous_name).length,blank_source_names:rows.filter(r=>!r.name).length,recovered_gps:rows.filter(r=>r.recovered_gps).length,usable_gps:rows.filter(r=>r.latitude!==null).length,source_sha256:actual};
  console.log(JSON.stringify({...stats,mode:process.argv.includes('--apply')?'apply':'plan'}));
  if(!process.argv.includes('--apply'))return;
  require('@next/env').loadEnvConfig(process.cwd());
  const {Client}=require('pg');const target=new URL(process.env.DATABASE_URL),host=target.hostname;
  if(process.env.DATABASE_HOST_ADDRESS)target.hostname=process.env.DATABASE_HOST_ADDRESS.includes(':')?'['+process.env.DATABASE_HOST_ADDRESS+']':process.env.DATABASE_HOST_ADDRESS;
  const db=new Client({connectionString:target.toString(),connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,servername:host,...(process.env.DATABASE_CA_PATH?{ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}:{})}});
  try{
    await db.connect();await db.query('begin');await db.query("select pg_advisory_xact_lock(hashtext('edge-legacy-enrichment'))");
    const owner=(await db.query("select p.id from profiles p join auth.users u on p.id=u.id where p.role='admin' and lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null")).rows[0];
    if(!owner)throw Error('Confirmed owner required');
    const company='10000000-0000-4000-8000-000000000001';let names=0,addresses=0,gps=0;
    const before=(await db.query('select count(*)::int n from legacy_customers where source_id=any($1::text[])',[rows.map(r=>r.source_id)])).rows[0].n;
    if(before!==rows.length)throw Error('Existing migration count mismatch');
    for(let i=0;i<rows.length;i+=200){const payload=JSON.stringify(rows.slice(i,i+200));
      // The previous source remains recorded by source_checksum. New provenance
      // is separate; imported contacts do not overwrite live profile details.
      const result=await db.query(`update legacy_customers c set
        first_name=case when trim(c.first_name||' '||c.last_name)=x.previous_name or c.details->>'full_export_sha256'=$2 then x.first_name else c.first_name end,
        last_name=case when trim(c.first_name||' '||c.last_name)=x.previous_name or c.details->>'full_export_sha256'=$2 then x.last_name else c.last_name end,
        address=c.address||x.address,details=c.details||jsonb_build_object('full_export_sha256',$2::text,'full_name_available',length(x.name)>0,'truncated_name',right(x.name,3)='...','blank_name',length(x.name)=0),updated_at=now()
        from jsonb_to_recordset($1::jsonb) x(source_id text,first_name text,last_name text,name text,previous_name text,address jsonb)
        where c.source_id=x.source_id returning c.source_id`,[payload,actual]);names+=result.rowCount;
      const changed=await db.query(`update field_stores s set
        name=case when s.name=x.previous_name and length(x.name)>0 then left(x.name,100) else s.name end,
        address=case when s.address=x.previous_address then x.display_address else s.address end,
        latitude=case when s.latitude is null and s.longitude is null and s.location_source='missing' then x.latitude else s.latitude end,
        longitude=case when s.latitude is null and s.longitude is null and s.location_source='missing' then x.longitude else s.longitude end,
        location_updated_at=case when s.latitude is null and s.longitude is null and s.location_source='missing' and x.latitude is not null then now() else s.location_updated_at end,
        location_source=case when s.latitude is null and s.longitude is null and s.location_source='missing' and x.latitude is not null then 'legacy' else s.location_source end
        from jsonb_to_recordset($1::jsonb) x(source_id text,name text,previous_name text,previous_address text,display_address text,latitude double precision,longitude double precision)
        where s.company_id=$2 and s.legacy_customer_id=x.source_id returning s.latitude`,[payload,company]);addresses+=changed.rowCount;gps+=changed.rows.filter(r=>r.latitude!==null).length;
    }
    const after=(await db.query('select count(*)::int n,count(latitude)::int gps from field_stores where company_id=$1 and legacy_customer_id=any($2::text[])',[company,rows.map(r=>r.source_id)])).rows[0];
    if(after.n!==expected||gps!==after.gps)throw Error('Post-enrichment count mismatch');
    await db.query("insert into platform_audit(company_id,actor,action,detail) values($1,$2,'legacy.customers.enrich',$3)",[company,owner.id,{...stats,processed_contacts:names,processed_outlets:addresses,gps_after:after.gps,auth_users_created:0,emails_sent:0}]);
    await db.query('commit');console.log(JSON.stringify({verified_customers:after.n,gps_after:after.gps,auth_users_created:0,emails_sent:0}));
  }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('Enrichment failed: '+e.message);process.exitCode=1;});
module.exports={enrich};
