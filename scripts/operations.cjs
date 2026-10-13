// Database-owner operations, run deliberately from a trusted deployment machine.
require('@next/env').loadEnvConfig(process.cwd());
const {Client}=require('pg');
const {readFileSync}=require('node:fs');
async function main(){
  if(!process.env.DATABASE_URL || !process.env.DATABASE_CA_PATH)throw new Error('DATABASE_URL and DATABASE_CA_PATH are required');
  const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:12000,ssl:{rejectUnauthorized:true,ca:readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
  try{
    await db.connect();
    if(process.argv.includes('--schedule')){
      await db.query('BEGIN');
      try{
        await db.query('create extension if not exists pg_cron with schema pg_catalog');
        await db.query("select cron.schedule('edgedirect2u-expire-reservations','*/5 * * * *','select public.expire_reservations();')");
        await db.query('COMMIT');
        console.log('Reservation expiry scheduled every five minutes inside Supabase. No HTTP secret or hosting worker is required for this job.');
      }catch(error){await db.query('ROLLBACK');throw error;}
    }
    const emailIndex=process.argv.indexOf('--admin-email');
    if(emailIndex!==-1){
      const email=process.argv[emailIndex+1];
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Supply the explicitly authorized administrator email');
      await db.query('BEGIN');
      try{
        const users=await db.query('select id,email_confirmed_at,is_anonymous from auth.users where lower(email)=lower($1) for update',[email]);
        if(users.rows.length!==1 || !users.rows[0].email_confirmed_at || users.rows[0].is_anonymous)throw new Error('The selected account must be registered and email-confirmed first. No role changed.');
        const id=users.rows[0].id;
        await db.query("update public.profiles set role='admin',merchant_id=null where id=$1",[id]);
        await db.query("insert into public.audit_logs(actor,action,detail) values($1,'bootstrap_admin',jsonb_build_object('method','trusted_database_owner'))",[id]);
        await db.query('COMMIT');console.log('The selected confirmed account now has administrator access.');
      }catch(error){await db.query('ROLLBACK');throw error;}
    }
    const roles=await db.query('select role,count(*)::int accounts from public.profiles group by role order by role');
    console.log(`Account role counts: ${JSON.stringify(roles.rows)}`);
    const extension=await db.query("select extname from pg_extension where extname='pg_cron'");
    if(extension.rows.length){
      const jobs=await db.query("select jobid,schedule,active from cron.job where jobname='edgedirect2u-expire-reservations'");
      console.log(`Reservation scheduler: ${JSON.stringify(jobs.rows)}`);
      const runs=await db.query("select d.status,d.return_message,d.start_time,d.end_time from cron.job_run_details d join cron.job j using(jobid) where j.jobname='edgedirect2u-expire-reservations' order by d.start_time desc limit 3");
      console.log(`Recent scheduler runs: ${JSON.stringify(runs.rows)}`);
    }else console.log('Reservation scheduler: not enabled');
  }finally{await db.end();}
}
main().catch(error=>{console.error(`Operation failed (${error.code || 'configuration'}): ${error.message}`);process.exitCode=1;});
