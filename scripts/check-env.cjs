require('@next/env').loadEnvConfig(process.cwd());
const required=['NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','PAYSTACK_SECRET_KEY'];
const missing=required.filter(key=>!process.env[key]);
const problems=missing.map(key=>`${key} is missing`);
for(const key of ['NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_SUPABASE_URL']){if(process.env[key]){try{const url=new URL(process.env[key]);if(url.protocol!=='https:')problems.push(`${key} must use HTTPS for launch`);}catch{problems.push(`${key} must be a valid URL`);}}}
if(process.env.CRON_SECRET&&process.env.CRON_SECRET.length<32)problems.push('CRON_SECRET must contain at least 32 characters');
if(process.env.LOCAL_DEMO!=='false')problems.push('Set LOCAL_DEMO=false for deployment');
if(problems.length){console.error('Launch configuration needs attention:\n'+problems.map(p=>`- ${p}`).join('\n'));process.exitCode=1;}else console.log('Required launch values are present. Verify service connectivity, permissions and test payments separately.');
