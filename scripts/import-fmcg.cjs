// Deployment-only, transactional import of researched drafts and approved staff emails.
// Never creates passwords, fake inventory, paid orders or public product listings.
require('@next/env').loadEnvConfig(process.cwd());
const {Client}=require('pg');const fs=require('node:fs');
const source=JSON.parse(fs.readFileSync('data/fmcg-research-2026-10-15.json','utf8'));
const rows=source.rows.filter(r=>!r.comparisonOnly);
const approvals=[['gm@edgedirect2u.com','warehouse_manager',null],['it@edgedirect2u.com','it_manager',null],['account@edgedirect2u.com','accounts',null],['client@edgedirect2u.com','client','pz']];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function restImport(){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.NEXT_PUBLIC_SUPABASE_URL)throw new Error('Private service credentials required for HTTPS fallback');
 const {createClient}=require('@supabase/supabase-js');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
 const users=check(await db.auth.admin.listUsers({page:1,perPage:1000}));
 const owner=users.users.find(u=>u.email?.toLowerCase()==='olasodechukwudi@gmail.com'&&u.email_confirmed_at&&!u.is_anonymous);
 if(!owner)throw new Error('Confirmed owner missing');
 const profile=check(await db.from('profiles').select('role').eq('id',owner.id).single());if(profile.role!=='admin')throw new Error('Owner must be administrator');
 check(await db.from('business_principals').upsert({id:'pz',name:'PZ Cussons'},{onConflict:'id',ignoreDuplicates:true}));
 const prior=check(await db.from('business_access').select('email,role,principal_id,active').in('email',approvals.map(a=>a[0])));
 for(const [email,role,principal] of approvals){const old=prior.find(a=>a.email===email);if(old&&(old.role!==role||old.principal_id!==principal||!old.active))throw new Error('Review existing approval in portal: '+email);}
 check(await db.from('business_access').upsert(approvals.map(([email,role,principal_id])=>({email,role,principal_id,active:true,approved_by:owner.id})),{onConflict:'email',ignoreDuplicates:true}));
 const categories=[...new Set(rows.map(r=>r.category))].map(name=>({id:'fmcg-'+slug(name),name,image:'/images/fmcg-placeholder.svg'}));
 check(await db.from('categories').upsert(categories,{onConflict:'id',ignoreDuplicates:true}));
 const products=rows.map(r=>({id:'fmcg-sm-'+r.sourceId,slug:r.sourceHandle+'-sm',name:r.name,category_id:'fmcg-'+slug(r.category),brand:r.brand,merchant_id:'edge',merchant_name:'E-Edge Direct 2U',price_kobo:Math.round(r.price*100),stock:0,reserved:0,image:'/images/fmcg-placeholder.svg',description:r.name+'. Listed pack: '+r.pack+'.',active:false,featured:false}));
 const inserted=check(await db.from('products').upsert(products,{onConflict:'id',ignoreDuplicates:true}).select('id'));
 check(await db.from('business_research').upsert(rows.map(r=>({product_id:'fmcg-sm-'+r.sourceId,source_url:r.url,verified_on:r.verifiedOn,retailer:r.retailer,retail_price_kobo:Math.round(r.price*100),manufacturer:r.manufacturer,pack_size:r.pack,unit:r.unit,notes:r.notes})),{onConflict:'product_id',ignoreDuplicates:true}));
 check(await db.from('business_product_principals').upsert(rows.filter(r=>r.principal).map(r=>({product_id:'fmcg-sm-'+r.sourceId,principal_id:r.principal})),{onConflict:'product_id',ignoreDuplicates:true}));
 check(await db.from('audit_logs').insert({actor:owner.id,action:'business.research.import.https',detail:{date:'2026-10-15',drafts_created:inserted.length,approved_emails:approvals.map(a=>a[0]),method:'trusted_deployment_service',staged_tables:true}}));
 const final=check(await db.from('products').select('id,active,stock,reserved').in('id',products.map(p=>p.id)));
 const research=check(await db.from('business_research').select('product_id').in('product_id',products.map(p=>p.id)));
 if(final.length!==250||research.length!==250)throw new Error('Incomplete import; safe to rerun to resume');
 console.log(JSON.stringify({created:inserted.length,drafts:final.length,active:final.filter(p=>p.active).length,with_stock:final.filter(p=>p.stock||p.reserved).length,research_records:research.length,approvals:approvals.length,method:'HTTPS staged fallback; all inserts preserve existing records'}));
}
async function main(){
 if(rows.length<200||new Set(rows.map(r=>r.sourceId)).size!==rows.length||rows.some(r=>!Number.isFinite(r.price)||r.price<=0||!r.url.startsWith('https://www.supermart.ng/products/')||r.verifiedOn!=='2026-10-15'||!/^[a-f0-9]{64}$/.test(r.evidenceSha256)))throw new Error('Research manifest failed validation');
 console.log(`Plan: ${rows.length} inactive, zero-stock drafts; ${approvals.length} approved staff emails; PZ-only client scope. Existing products will not be overwritten.`);
 if(!process.argv.includes('--apply'))return;
 if(process.argv.includes('--rest'))return restImport();
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required in ignored environment');
 const databaseUrl=new URL(process.env.DATABASE_URL),expectedHost=databaseUrl.hostname;
 // Optional operator-supplied resolved address; certificate identity remains the database hostname.
 if(process.env.DATABASE_HOST_ADDRESS)databaseUrl.hostname=process.env.DATABASE_HOST_ADDRESS.includes(':')?'['+process.env.DATABASE_HOST_ADDRESS+']':process.env.DATABASE_HOST_ADDRESS;
 const db=new Client({connectionString:databaseUrl.toString(),connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,servername:expectedHost,...(process.env.DATABASE_CA_PATH?{ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}:{})}});
 try{await db.connect();await db.query('begin');
  await db.query("select pg_advisory_xact_lock(hashtext('edge-fmcg-import-2026-10-15'))");
  const owner=(await db.query("select u.id from auth.users u join profiles p on p.id=u.id where lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null and p.role='admin'")).rows[0];if(!owner)throw new Error('Confirmed owner administrator required');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.id]);
  await db.query("insert into business_principals values('pz','PZ Cussons') on conflict do nothing");
  for(const [email,role,principal] of approvals){const prior=(await db.query('select role,principal_id,active from business_access where email=$1',[email])).rows[0];if(prior){if(prior.role!==role||prior.principal_id!==principal||!prior.active)throw new Error('Existing approval differs; review in portal: '+email);}else await db.query('select business_set_access($1,$2,$3,true)',[email,role,principal]);}
  const payload=JSON.stringify(rows.map(r=>({...r,id:'fmcg-sm-'+r.sourceId,slug:r.sourceHandle+'-sm',category_id:'fmcg-'+slug(r.category),price_kobo:Math.round(r.price*100)})));
  await db.query("insert into categories(id,name,image) select distinct x->>'category_id',x->>'category','/images/fmcg-placeholder.svg' from jsonb_array_elements($1::jsonb) x on conflict do nothing",[payload]);
  const inserted=await db.query("insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,stock,reserved,image,description,active,featured) select x->>'id',x->>'slug',x->>'name',x->>'category_id',x->>'brand','edge','E-Edge Direct 2U',(x->>'price_kobo')::bigint,0,0,'/images/fmcg-placeholder.svg',(x->>'name')||'. Listed pack: '||(x->>'pack')||'.',false,false from jsonb_array_elements($1::jsonb) x on conflict(id) do nothing returning id",[payload]);
  const ids=inserted.rows.map(r=>r.id),created=ids.length;
  await db.query("insert into business_research(product_id,source_url,verified_on,retailer,retail_price_kobo,manufacturer,pack_size,unit,notes) select x->>'id',x->>'url',(x->>'verifiedOn')::date,x->>'retailer',(x->>'price_kobo')::bigint,x->>'manufacturer',x->>'pack',x->>'unit',x->>'notes' from jsonb_array_elements($1::jsonb) x where x->>'id'=any($2::text[])",[payload,ids]);
  await db.query("insert into business_product_principals(product_id,principal_id) select x->>'id',x->>'principal' from jsonb_array_elements($1::jsonb) x where x->>'id'=any($2::text[]) and x->>'principal' is not null",[payload,ids]);
  await db.query("select audit('business.research.import',jsonb_build_object('date','2026-10-15','drafts_created',$1::int,'retailer','Supermart.ng'))",[created]);
  await db.query('commit');
  const counts=(await db.query("select count(*)::int drafts,count(*) filter(where active)::int active,count(*) filter(where stock<>0 or reserved<>0)::int with_stock from products where id like 'fmcg-sm-%'")).rows[0];
  console.log(JSON.stringify({created,...counts,access:'Approved emails; each person must register, confirm email and sign in. No passwords were created.'}));
 }catch(e){await db.query('rollback');throw e;}finally{await db.end();}
}
main().catch(e=>{console.error('Import failed: '+e.message);process.exitCode=1;});
