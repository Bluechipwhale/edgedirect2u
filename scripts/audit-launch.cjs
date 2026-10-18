// Read-only commissioning audit. No role changes, invitations, sales or jobs.
require('@next/env').loadEnvConfig(process.cwd());
const {readFileSync}=require('node:fs');
const {Client}=require('pg');
async function httpsAudit(){
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Private service credentials required for HTTPS audit');
  const {createClient}=require('@supabase/supabase-js');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const count=async(table,filter=x=>x)=>{const result=await filter(db.from(table).select('*',{count:'exact',head:true})).abortSignal(AbortSignal.timeout(12000));if(result.error)throw Error(table+' count unavailable');return result.count;};
  const queries={products:count('products'),published:count('products',q=>q.eq('active',true).is('archived_at',null)),drafts:count('products',q=>q.eq('active',false).is('archived_at',null)),
    drivers:count('drivers'),field_agents:count('platform_memberships',q=>q.eq('role','field_agent').eq('active',true)),outlets:count('field_stores',q=>q.eq('active',true)),located:count('field_stores',q=>q.eq('active',true).not('latitude','is',null)),pending_staff:count('company_staff_invitations',q=>q.eq('active',true).is('claimed_at',null))};
  const entries=await Promise.all(Object.entries(queries).map(async([key,value])=>[key,await value]));console.log(JSON.stringify({read_only:true,method:'HTTPS HEAD requests',...Object.fromEntries(entries)}));
}
async function main(){
  if(process.argv.includes('--https'))return httpsAudit();
  if(!process.env.DATABASE_URL||!process.env.DATABASE_CA_PATH)throw Error('Trusted database connection and CA are required');
  const target=new URL(process.env.DATABASE_URL),host=target.hostname;
  if(process.env.DATABASE_HOST_ADDRESS)target.hostname=process.env.DATABASE_HOST_ADDRESS.includes(':')?'['+process.env.DATABASE_HOST_ADDRESS+']':process.env.DATABASE_HOST_ADDRESS;
  const db=new Client({connectionString:target.toString(),connectionTimeoutMillis:12000,ssl:{rejectUnauthorized:true,servername:host,ca:readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
  try{
    await db.connect();await db.query('begin read only');await db.query("set local statement_timeout='12s'");
    const catalogue=(await db.query(`select count(*)::int products,count(*) filter(where active and archived_at is null)::int published,
      count(*) filter(where active and archived_at is null and stock>reserved)::int purchasable,
      count(*) filter(where not active and archived_at is null)::int drafts from products`)).rows[0];
    const roles=(await db.query('select role,count(*)::int accounts from profiles group by role order by role')).rows;
    const staff=(await db.query(`select role,count(*)::int approved,count(user_id)::int registered from business_access where active group by role order by role`)).rows;
    const field=(await db.query(`select count(*)::int outlets,count(latitude)::int located,
      count(*) filter(where latitude is null)::int location_needed from field_stores where active`)).rows[0];
    const drivers=(await db.query('select count(*)::int registered,count(*) filter(where available)::int available from drivers')).rows[0];
    const agents=(await db.query("select count(*)::int active from platform_memberships where role='field_agent' and active")).rows[0];
    const scheduler=(await db.query(`select j.jobname,j.active,j.schedule,(select d.status from cron.job_run_details d where d.jobid=j.jobid order by d.start_time desc limit 1) last_status
      from cron.job j where j.jobname in ('edgedirect2u-expire-reservations','edgedirect2u-location-retention') order by jobname`)).rows;
    console.log(JSON.stringify({read_only:true,catalogue,roles,staff,field,drivers,agents,scheduler}));
    await db.query('rollback');
  }finally{await db.end();}
}
main().catch(error=>{console.error('Launch audit failed: '+error.message);process.exitCode=1;});
