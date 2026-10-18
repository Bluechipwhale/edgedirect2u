// Owner-authorized catalogue cutover. No SQL from the old export is executed.
const fs=require('node:fs'),crypto=require('node:crypto');
const SOURCE='2304c7c16da4d06288e2396980e4c3a7e6d3037c67cbde3a0750032ec5d57afc';
const clean=v=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
function kobo(value){const m=String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);if(!m)throw Error('Invalid source price');const n=BigInt(m[1])*100n+BigInt((m[2]||'').padEnd(2,'0'));if(n<1n||n>1000000000n)throw Error('Price outside supported range');return Number(n);}
function normalize(parsed){
 const brands=new Map(parsed.tables.brands.map(r=>[r.id,r.name])),categories=new Map(parsed.tables.categories.map(r=>[r.id,r]));
 const rows=parsed.tables.products.map(r=>{
  if(r.product_type!=='physical'||Number(r.tax)!==0||Number(r.discount)!==0)throw Error('Review source tax, discount or digital product');
  if(r.status==='1'&&Number(r.minimum_order_qty||1)!==1)throw Error('Review minimum order quantity');
  const variants=JSON.parse(r.variation||'[]');if(variants.some(v=>clean(v.type)||Number(v.price)||Number(v.qty)))throw Error('Review source variations');
  const stock=Number(r.current_stock);if(!Number.isSafeInteger(stock)||stock<0)throw Error('Invalid source stock');
  const sourceCat=String(JSON.parse(r.category_ids||'[]').sort((a,b)=>Number(b.position)-Number(a.position))[0]?.id||'');
  if(!brands.has(r.brand_id))throw Error('Unknown source brand');
  if(!categories.has(sourceCat)&&r.status==='1')throw Error('Active source category missing; review required');
  const cat=categories.has(sourceCat)?sourceCat:'review';
  if(cat==='review')categories.set('review',{id:'review',name:'Imported products — category review',parent_id:'0'});
  const filename=clean(r.thumbnail);if(filename&&!/^[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(filename))throw Error('Invalid image filename');
  const slug=clean(r.slug).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const text=clean(r.details).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&rsquo;/g,"'").replace(/&hellip;/g,'…').replace(/\s+/g,' ').trim();
  return {source_id:r.id,id:'legacy-catalog-'+r.id,slug:`legacy-${r.id}-${slug}`,name:clean(r.name),category_id:'legacy-category-'+cat,brand:brands.get(r.brand_id),price_kobo:kobo(r.unit_price),stock,active:r.status==='1',featured:r.featured_status==='1',image:filename?`https://edgedirect2u.com.ng/storage/app/public/product/thumbnail/${filename}`:'/images/fmcg-placeholder.svg',description:(text||clean(r.name)).slice(0,500),source_data:{name:r.name,slug:r.slug,brand_id:r.brand_id,category_ids:JSON.parse(r.category_ids),unit:r.unit,minimum_order_qty:r.minimum_order_qty,unit_pack:r.unit_pack,unit_row:r.unit_row,parent_id:r.parent_id,sku:r.code,price_naira:r.unit_price,current_stock:r.current_stock,status:r.status,thumbnail:filename,updated_at:r.updated_at}};
 });
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate source IDs');
 return {rows,categories:[...categories.values()].map(r=>({id:'legacy-category-'+r.id,name:r.name,parent_id:r.parent_id==='0'?null:'legacy-category-'+r.parent_id}))};
}
async function main(){
 const parsed=JSON.parse(fs.readFileSync('.data/legacy-server-parsed.json','utf8'));
 const sha=crypto.createHash('sha256').update(fs.readFileSync('.data/legacy-server.sql.gz')).digest('hex');if(sha!==SOURCE||parsed.source_sha256!==SOURCE)throw Error('Original export checksum mismatch');
 const {rows,categories}=normalize(parsed),expected=Number(process.argv.find(v=>v.startsWith('--expect='))?.slice(9));if(rows.length!==expected)throw Error('Explicit full --expect count required');
 const stats={source_sha256:sha,products:rows.length,active:rows.filter(r=>r.active).length,purchasable:rows.filter(r=>r.active&&r.stock>0).length,stock_units:rows.reduce((n,r)=>n+r.stock,0),pack_relationships:rows.filter(r=>r.source_data.parent_id).length,research_drafts_changed:0};console.log(JSON.stringify({...stats,mode:process.argv.includes('--apply')?'apply':'plan'}));
 if(!process.argv.includes('--apply')&&!process.argv.includes('--verify-photos'))return;
 // Each distinct source photo must resolve to a real image before publication.
 const checked=new Map(),verified=[];
 const photo=async(url)=>{if(!checked.has(url))checked.set(url,(async()=>{try{const response=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(20000)});return response.ok&&response.headers.get('content-type')?.startsWith('image/');}catch{return false;}})());return checked.get(url);};
 for(let i=0;i<rows.length;i+=6)await Promise.all(rows.slice(i,i+6).map(async r=>{
  const original=parsed.tables.products.find(p=>p.id===r.source_id);
  const candidates=[r.image,...JSON.parse(original.images||'[]').filter(f=>/^[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(f)).map(f=>`https://edgedirect2u.com.ng/storage/app/public/product/${f}`)].filter(u=>u.startsWith('https:'));
  let selected=null;for(const url of candidates)if(await photo(url)){selected=url;break;}
  r.image=selected||'/images/fmcg-placeholder.svg';r.source_data.photo_verified=!!selected;r.source_data.photo_url=selected;
  verified.push({source_id:r.source_id,image:r.image,verified:!!selected,active:r.active});
 }));
 fs.writeFileSync('.data/legacy-photo-verification.json',JSON.stringify({source_sha256:sha,checked_at:new Date().toISOString(),rows:verified},null,2));
 console.log(JSON.stringify({source_photos_verified:verified.filter(r=>r.verified).length,photos_missing:verified.filter(r=>!r.verified).length,active_photos_missing:verified.filter(r=>r.active&&!r.verified).length}));
 if(!process.argv.includes('--apply'))return;
 require('@next/env').loadEnvConfig(process.cwd());const {Client}=require('pg');
 const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
 try{await db.connect();await db.query('begin');await db.query("select pg_advisory_xact_lock(hashtext('edge-legacy-catalogue'))");
  const owner=(await db.query("select p.id from profiles p join auth.users u on u.id=p.id where p.role='admin' and lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null")).rows[0];if(!owner)throw Error('Confirmed owner required');
  const merchant=(await db.query("select id from merchants where id='edge' and status='approved'")).rows[0];if(!merchant)throw Error('Approved flagship merchant required');
  if(!(await db.query("select id from business_principals where id='pz' and name ilike '%PZ%'")).rowCount)throw Error('Verified PZ principal required');
  for(const c of categories)await db.query("insert into categories(id,name,image,parent_id) values($1,$2,'',$3) on conflict(id) do nothing",[c.id,c.name,c.parent_id]);
  let inserted=0,skipped=0;
  for(const r of rows){
   const prior=(await db.query('select * from legacy_catalogue_source where source_id=$1 for update',[r.source_id])).rows[0];
   if(prior){if(prior.source_sha256!==sha||prior.product_id!==r.id||Number(prior.source_price_kobo)!==r.price_kobo||prior.source_stock!==r.stock||prior.source_active!==r.active)throw Error('Source mapping changed; manual review required');skipped++;continue;}
   await db.query("insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,stock,image,images,description,options,featured,active) values($1,$2,$3,$4,$5,'edge','E-Edge Direct 2U',$6,$7,$8,$9,$10,'{}',$11,$12)",[r.id,r.slug,r.name,r.category_id,r.brand,r.price_kobo,r.stock,r.image,JSON.stringify([]),r.description,r.featured,r.active]);
   await db.query('insert into legacy_catalogue_source(source_id,product_id,source_sha256,source_price_kobo,source_stock,source_active,source_data) values($1,$2,$3,$4,$5,$6,$7)',[r.source_id,r.id,sha,r.price_kobo,r.stock,r.active,r.source_data]);
   if(r.stock)await db.query("insert into stock_movements(product_id,quantity,reason,actor) values($1,$2,'Owner-confirmed legacy opening stock; source SKU '||$3,$4)",[r.id,r.stock,r.source_id,owner.id]);
   if(r.source_data.brand_id==='1')await db.query("insert into business_product_principals(product_id,principal_id) values($1,'pz')",[r.id]);
   inserted++;
  }
  const result=(await db.query('select count(*)::int n from legacy_catalogue_source where source_sha256=$1',[sha])).rows[0];if(result.n!==expected)throw Error('Catalogue reconciliation failed');
  // Re-running preserves every later admin edit, sale, archive and stock movement.
  await db.query("insert into platform_audit(company_id,actor,action,detail) values('10000000-0000-4000-8000-000000000001',$1,'legacy.catalogue.import',$2)",[owner.id,{...stats,inserted,skipped,stock_policy:'Independent original SKU quantities; no pack conversion or historical order replay',verified_photos:verified.filter(r=>r.verified).length,missing_photos:verified.filter(r=>!r.verified).map(r=>r.source_id)}]);
  await db.query('commit');console.log(JSON.stringify({verified_source_products:result.n,inserted,already_imported_preserved:skipped,orders_created:0,auth_users_created:0}));
 }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('Catalogue import failed: '+e.message);process.exitCode=1;});
module.exports={normalize,kobo,main};
