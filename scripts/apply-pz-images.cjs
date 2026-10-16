// Deploy the tracked image assets first, then attach them to untouched PZ drafts.
require('@next/env').loadEnvConfig(process.cwd());
const {Client}=require('pg'),fs=require('node:fs'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('data/pz-product-images.json','utf8'));
async function main(){
 if(manifest.length!==21)throw new Error('Expected the reviewed 21-image manifest');
 for(const item of manifest){if(!/^\/images\/pz\/\d+\.(jpg|png|webp)$/.test(item.image)||crypto.createHash('sha256').update(fs.readFileSync('public'+item.image)).digest('hex')!==item.sha256)throw new Error('Image validation failed: '+item.productId);}
 console.log('Plan: attach 21 reviewed photos to unchanged, inactive PZ drafts. No stock or publication changes.');
 if(!process.argv.includes('--apply'))return;
 if(!process.env.DATABASE_URL||!process.env.DATABASE_CA_PATH)throw new Error('Verified database connection settings required');
 const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
 try{await db.connect();await db.query('begin');
  const owner=(await db.query("select u.id from auth.users u join profiles p on p.id=u.id where lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null and p.role='admin'")).rows[0];if(!owner)throw new Error('Confirmed administrator owner required');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.id]);
  const payload=JSON.stringify(manifest.map(i=>({id:i.productId,image:i.image,source:i.imageSource,note:i.note})));
  const result=await db.query("update products p set image=x->>'image',images=jsonb_build_array(x->>'image') from jsonb_array_elements($1::jsonb) x where p.id=x->>'id' and exists(select 1 from business_product_principals b where b.product_id=p.id and b.principal_id='pz') and not p.active and p.stock=0 and p.reserved=0 and (p.image='/images/fmcg-placeholder.svg' or p.image=x->>'image') and (p.images='[]'::jsonb or p.images=jsonb_build_array(x->>'image')) returning p.id",[payload]);
  if(result.rowCount!==21)throw new Error('Some drafts have changed; review individually rather than overwrite owner edits');
  await db.query("update business_research r set notes=r.notes||' Image source: '||(x->>'source')||'. '||(x->>'note') from jsonb_array_elements($1::jsonb) x where r.product_id=x->>'id' and position('Image source:' in r.notes)=0",[payload]);
  await db.query("select audit('business.pz.images',jsonb_build_object('images',21,'reviewed_on','2026-10-16','publication_changed',false))");
  await db.query('commit');console.log('Attached and verified 21 PZ product photos. Draft status and stock preserved.');
 }catch(e){await db.query('rollback');throw e;}finally{await db.end();}
}
main().catch(e=>{console.error('Image attachment failed: '+e.message);process.exitCode=1;});
