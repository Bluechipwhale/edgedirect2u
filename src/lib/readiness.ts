import 'server-only';
import { configured, localMode, supabase } from './server';
export type ReadinessCheck = { name:string; ready:boolean; detail:string };
export async function readiness():Promise<ReadinessCheck[]> {
  let database=false;
  let scheduler=false;
  let schedulerDetail='Configure Supabase Cron to run expire_reservations every five minutes, or schedule the protected HTTP endpoint. A stored secret alone does not verify the job.';
  if (configured()) {
    try {
      const { data,error } = await (await supabase()).from('website_settings').select('id').eq('id','published').abortSignal(AbortSignal.timeout(5000)).single();
      database=!error && data?.id==='published';
      if(database){
        const {data:job}=await(await supabase()).rpc('reservation_scheduler_status').abortSignal(AbortSignal.timeout(5000));
        scheduler=Boolean(job?.active && job?.schedule==='*/5 * * * *' && job?.last_status==='succeeded' && Date.parse(job.last_run)>Date.now()-15*60000);
        if(job?.active)schedulerDetail=scheduler?'Supabase reservation cleanup has completed successfully within the last 15 minutes.':`Supabase job is active. Most recent status: ${job?.last_status || 'awaiting first run'}. Verify its next run in Supabase Cron.`;
      }
    } catch { /* Only return safe status; never expose credentials or provider errors. */ }
  }
  const local=await localMode();
  let https=false;
  try { https=new URL(process.env.NEXT_PUBLIC_SITE_URL || '').protocol==='https:'; } catch {}
  return [
    {name:'Commerce database',ready:database,detail:database?'Published settings are reachable through the public API.':'Apply migrations and verify the Supabase URL and public key.'},
    {name:'Privileged payment & upload services',ready:!!process.env.SUPABASE_SERVICE_ROLE_KEY,detail:'A server-only Supabase service-role key is required for verified payments, refunds and branding uploads.'},
    {name:'Payment processing',ready:!!process.env.PAYSTACK_SECRET_KEY,detail:'Configure Paystack keys and the signed webhook. Run a real test payment and refund before accepting live orders.'},
    {name:'Reservation scheduler',ready:scheduler,detail:schedulerDetail},
    {name:'HTTPS storefront',ready:https,detail:'Set NEXT_PUBLIC_SITE_URL to the canonical HTTPS domain and add its email callback URLs to Supabase Auth.'},
    {name:'Production mode',ready:!local && process.env.LOCAL_DEMO==='false',detail:'Deploy with LOCAL_DEMO=false. Development fixtures are never enabled in production.'},
  ];
}
