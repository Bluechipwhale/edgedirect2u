// Private deployment operation for the owner's former store. It never creates
// Auth users, passwords, orders, payment records, or customer emails.
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {Client}=require('pg');

const option=(name)=>{const item=process.argv.find(arg=>arg.startsWith(`--${name}=`));return item?.slice(name.length+3);};
const file=option('file')||'.data/legacy-customers.json';
const expected=option('expect')===undefined?null:Number(option('expect'));
const apply=process.argv.includes('--apply');
const sha=value=>createHash('sha256').update(value).digest('hex');
const clean=(value,max)=>{
  if(value!==null&&value!==undefined&&typeof value!=='string'&&typeof value!=='number')throw new Error('Invalid customer field in export');
  return String(value??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,max);
};
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(source){
  if(!Array.isArray(source))throw new Error('Expected a JSON array of verified customer rows');
  const byId=new Map();let legacyUnverified=0,unusableEmail=0,duplicateIdentical=0,truncatedNames=0,blankNames=0;
  for(const raw of source){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid customer row');
    if(typeof raw.verified!=='boolean')throw new Error('Missing old-store verification status');
    if(!raw.verified)legacyUnverified++;
    const id=clean(raw.legacyId,100);
    if(!/^[1-9][0-9]{0,99}$/.test(id))throw new Error('Invalid legacy customer ID in export');
    const name=clean(raw.name,160);
    const truncatedName=name.endsWith('...');
    if(truncatedName)truncatedNames++;
    if(!name)blankNames++;
    const originalEmail=clean(raw.email,512).toLowerCase();
    const email=originalEmail&&originalEmail.length<=254&&emailPattern.test(originalEmail)&&!/(\.local|\.test|\.invalid)$/.test(originalEmail)?originalEmail:null;
    if(originalEmail&&!email)unusableEmail++;
    const phone=clean(raw.phone,80);
    const route=clean(raw.route,160);
    const oldAddress=raw.address&&typeof raw.address==='object'&&!Array.isArray(raw.address)?raw.address:{};
    const address={street:clean(oldAddress.street,500),city:clean(oldAddress.city,120),state:clean(oldAddress.state,120)};
    const orderCount=raw.totalOrders===undefined||raw.totalOrders===null||raw.totalOrders===''?null:Number(String(raw.totalOrders).replaceAll(',',''));
    if(orderCount!==null&&(!Number.isSafeInteger(orderCount)||orderCount<0||orderCount>1000000))throw new Error('Invalid legacy order count');
    const row={source_id:id,first_name:name,last_name:'',email,phone,route,address,legacy_order_count:orderCount,
      details:{legacy_verified:raw.verified,truncated_name:truncatedName,blank_name:!name,...(originalEmail&&!email?{unusable_legacy_email:originalEmail}:{})}};
    row.source_checksum=sha(JSON.stringify(row));
    const previous=byId.get(id);
    if(previous){if(previous.source_checksum!==row.source_checksum)throw new Error('Conflicting duplicate legacy customer ID');duplicateIdentical++;continue;}
    byId.set(id,row);
  }
  const rows=[...byId.values()].sort((a,b)=>Number(a.source_id)-Number(b.source_id));
  const mailCounts=new Map();for(const r of rows)if(r.email)mailCounts.set(r.email,(mailCounts.get(r.email)||0)+1);
  return {rows,stats:{source_rows:source.length,records:rows.length,legacy_verified:rows.length-legacyUnverified,legacy_unverified:legacyUnverified,truncated_names:truncatedNames,blank_names:blankNames,duplicate_identical:duplicateIdentical,unusable_email:unusableEmail,missing_email:rows.filter(r=>!r.email).length,ambiguous_emails:[...mailCounts.values()].filter(n=>n>1).reduce((sum,n)=>sum+n,0)}};
}

async function restImport(rows,evidenceHash){
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Private Supabase service credentials required for HTTPS import');
  const {createClient}=require('@supabase/supabase-js');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const checked=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
  let owner=null;
  for(let page=1;page<=25&&!owner;page++){
    const result=await db.auth.admin.listUsers({page,perPage:200});
    const users=checked(result)?.users||[];
    owner=users.find(user=>user.email?.toLowerCase()==='olasodechukwudi@gmail.com'&&user.email_confirmed_at);
    if(users.length<200)break;
  }
  if(!owner)throw new Error('Confirmed owner account unavailable');
  const profile=checked(await db.from('profiles').select('role').eq('id',owner.id).single());
  if(profile.role!=='admin')throw new Error('Owner administrator role is required');
  let created=0;
  for(let start=0;start<rows.length;start+=100){
    const batch=rows.slice(start,start+100),ids=batch.map(row=>row.source_id);
    const prior=checked(await db.from('legacy_customers').select('source_id,source_checksum').in('source_id',ids));
    for(const old of prior){const row=batch.find(item=>item.source_id===old.source_id);if(old.source_checksum!==row?.source_checksum)throw new Error('Existing customer differs from export; inspect before updating');}
    const inserted=checked(await db.from('legacy_customers').upsert(batch,{onConflict:'source_id',ignoreDuplicates:true}).select('source_id'));
    created+=inserted.length;
    const verified=checked(await db.from('legacy_customers').select('source_id,source_checksum').in('source_id',ids));
    if(verified.length!==batch.length||verified.some(old=>old.source_checksum!==batch.find(row=>row.source_id===old.source_id)?.source_checksum))throw new Error('HTTPS batch verification failed; safe to rerun');
  }
  checked(await db.from('audit_logs').insert({actor:owner.id,action:'legacy.customers.import.https',detail:{source:'edgedirect2u.com.ng',source_sha256:evidenceHash,source_rows:rows.length,created,staged_tables:true}}));
  console.log(JSON.stringify({imported:rows.length,created,already_present:rows.length-created,source_checked:true,emails_sent:0,auth_users_created:0,method:'HTTPS resumable batches'}));
}

async function main(){
  if(!fs.existsSync(file))throw new Error('Customer export file not found in the private .data directory');
  const resolved=fs.realpathSync(file),privateRoot=fs.realpathSync('.data');
  if(!resolved.toLowerCase().startsWith(privateRoot.toLowerCase()+require('node:path').sep.toLowerCase()))throw new Error('Customer export must stay inside ignored .data');
  const bytes=fs.readFileSync(resolved);
  if(bytes.length>20*1024*1024)throw new Error('Customer export exceeds 20 MB');
  const raw=JSON.parse(bytes.toString('utf8'));
  const {rows,stats}=normalize(Array.isArray(raw)?raw:raw.records);
  const evidenceHash=sha(bytes);
  if(expected!==null&&(!Number.isSafeInteger(expected)||expected<1||rows.length!==expected))throw new Error(`Expected ${expected} unique rows; found ${rows.length}`);
  if(rows.length===0)throw new Error('No customer rows to import');
  if(apply&&expected===null)throw new Error('Apply requires --expect=<full legacy customer count> to prevent partial imports');
  console.log(JSON.stringify({file:require('node:path').basename(file),source_sha256:evidenceHash,...stats,mode:apply?'apply':'plan'}));
  if(!apply)return;
  require('@next/env').loadEnvConfig(process.cwd());
  if(process.argv.includes('--rest'))return restImport(rows,evidenceHash);
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required in ignored .env.local');
  const url=new URL(process.env.DATABASE_URL),dbHost=url.hostname;
  if(process.env.DATABASE_HOST_ADDRESS)url.hostname=process.env.DATABASE_HOST_ADDRESS.includes(':')?'['+process.env.DATABASE_HOST_ADDRESS+']':process.env.DATABASE_HOST_ADDRESS;
  const db=new Client({connectionString:url.toString(),connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,servername:dbHost,...(process.env.DATABASE_CA_PATH?{ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}:{})}});
  try{
    await db.connect();await db.query('begin');
    await db.query("select pg_advisory_xact_lock(hashtext('edge-legacy-customer-import'))");
    const ready=(await db.query("select to_regclass('public.legacy_customers') is not null ready")).rows[0]?.ready;
    if(!ready)throw new Error('Apply 018_customer_migration.sql before importing');
    const owner=(await db.query("select u.id from auth.users u join profiles p on p.id=u.id where lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null and p.role='admin'")).rows[0];
    if(!owner)throw new Error('Confirmed owner administrator is required');
    let created=0;
    for(let start=0;start<rows.length;start+=250){
      const batch=rows.slice(start,start+250);
      const ids=batch.map(row=>row.source_id);
      const existing=(await db.query('select source_id,source_checksum from legacy_customers where source_id=any($1::text[])',[ids])).rows;
      for(const previous of existing){
        const incoming=batch.find(row=>row.source_id===previous.source_id);
        if(previous.source_checksum!==incoming?.source_checksum)throw new Error('Existing customer differs from export; inspect before updating');
      }
      const payload=JSON.stringify(batch);
      const result=await db.query(`insert into legacy_customers(source_id,first_name,last_name,email,phone,route,address,legacy_order_count,details,source_checksum)
        select x.source_id,x.first_name,x.last_name,x.email,x.phone,x.route,x.address,x.legacy_order_count,x.details,x.source_checksum
        from jsonb_to_recordset($1::jsonb) as x(source_id text,first_name text,last_name text,email text,phone text,route text,address jsonb,legacy_order_count integer,details jsonb,source_checksum text)
        on conflict(source_id) do nothing returning source_id`,[payload]);
      created+=result.rowCount;
    }
    const counts=(await db.query('select count(*)::int n from legacy_customers where source_id=any($1::text[])',[rows.map(row=>row.source_id)])).rows[0].n;
    if(counts!==rows.length)throw new Error('Post-import record count did not match source');
    await db.query("insert into audit_logs(actor,action,detail) values($1,'legacy.customers.import',jsonb_build_object('source','edgedirect2u.com.ng','source_sha256',$2::text,'source_rows',$3::int,'created',$4::int))",[owner.id,evidenceHash,rows.length,created]);
    await db.query('commit');
    console.log(JSON.stringify({imported:rows.length,created,already_present:rows.length-created,source_checked:true,emails_sent:0,auth_users_created:0}));
  }catch(error){await db.query('rollback');throw error;}finally{await db.end();}
}
if(require.main===module)main().catch(error=>{console.error('Customer import failed: '+error.message);process.exitCode=1;});
module.exports={normalize};
