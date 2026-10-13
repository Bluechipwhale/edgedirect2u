require('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');
async function main(){
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)throw new Error('Supabase public configuration is required');
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const results=await Promise.all([
    db.from('website_settings').select('id').eq('id','published').abortSignal(AbortSignal.timeout(10000)).single(),
    db.from('categories').select('id',{count:'exact',head:true}).abortSignal(AbortSignal.timeout(10000)),
    db.from('products').select('id',{count:'exact',head:true}).eq('active',true).abortSignal(AbortSignal.timeout(10000)),
    db.from('profiles').select('id').limit(1).abortSignal(AbortSignal.timeout(10000)),
    db.rpc('dashboard_metrics').abortSignal(AbortSignal.timeout(10000)),
  ]);
  const [theme,categories,products,profiles,metrics]=results;
  const checks=[
    ['Public theme',!theme.error && theme.data?.id==='published'],
    ['Public categories',!categories.error],
    ['Public catalogue',!products.error],
    ['Anonymous private profiles denied',(!profiles.error && profiles.data?.length===0) || [401,403].includes(profiles.status)],
    ['Anonymous dashboard RPC denied',[401,403].includes(metrics.status)],
  ];
  for(const [name,passed]of checks)console.log(`${passed?'PASS':'FAIL'} ${name}`);
  console.log(`Catalogue: ${categories.count??'unknown'} categories, ${products.count??'unknown'} active products.`);
  if(checks.some(([,passed])=>!passed))process.exitCode=1;
}
main().catch(()=>{console.error('Service verification failed. Check connectivity and public credentials; secrets are not logged.');process.exitCode=1;});
