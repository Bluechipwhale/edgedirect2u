// Public build defaults only. Server secrets belong in the hosting environment.
const {readFileSync,writeFileSync,existsSync}=require('node:fs');
const {resolve}=require('node:path');
const root=resolve(__dirname,'..');
const config=JSON.parse(readFileSync(resolve(root,'config/hostinger-public.json'),'utf8'));
const names=['NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','LOCAL_DEMO'];
if(Object.keys(config).length!==names.length || names.some(name=>typeof config[name]!=='string' || /[\r\n$"'#]/.test(config[name])))throw new Error('Hostinger defaults must contain exactly four public settings');
for(const name of names.slice(0,2)){
  const url=new URL(config[name]);
  if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Error(`${name} must be a public HTTPS origin`);
}
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.NEXT_PUBLIC_SUPABASE_URL) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.NEXT_PUBLIC_SUPABASE_ANON_KEY) || config.LOCAL_DEMO!=='false')throw new Error('Hostinger defaults require a hosted Supabase project, publishable key and disabled demo');
const output=resolve(root,'.env.production');
const content=names.map(name=>`${name}=${config[name]}`).join('\n')+'\n';
if(existsSync(output)){
  const existing=readFileSync(output,'utf8');
  const lines=existing.split(/\r?\n/).filter(line=>line.trim() && !line.trim().startsWith('#'));
  if(lines.some(line=>!names.some(name=>line.startsWith(name+'='))))throw new Error('Existing .env.production contains additional settings. Move private settings to the host environment before preparing public defaults.');
}
writeFileSync(output,content,{mode:0o600});
console.log('Prepared ignored .env.production with public Hostinger defaults. Host environment overrides take precedence; server secrets are excluded.');
