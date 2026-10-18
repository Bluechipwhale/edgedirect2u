// Copy only verified public product photographs into the existing asset bucket.
const fs=require('node:fs'),crypto=require('node:crypto');
async function main(){
 require('@next/env').loadEnvConfig(process.cwd());
 const {Client}=require('pg'),{createClient}=require('@supabase/supabase-js');
 const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
 const storage=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('brand-assets');
 try{await db.connect();
  const owner=(await db.query("select p.id from profiles p join auth.users u on p.id=u.id where p.role='admin' and lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null")).rows[0];if(!owner)throw Error('Confirmed owner required');
  const source=(await db.query("select s.product_id,s.source_data->>'photo_url' original_url,s.source_data->>'rehosted_url' rehosted_url,p.image from legacy_catalogue_source s join products p on p.id=s.product_id where s.source_data->>'photo_verified'='true' order by s.product_id")).rows;
  console.log(JSON.stringify({verified_source_products:source.length,mode:process.argv.includes('--apply')?'apply':'plan'}));if(!process.argv.includes('--apply'))return;
  let attached=0,preserved=0;const failures=[];
  for(const r of source){try{
   if(r.image!==r.original_url){preserved++;continue;}
   const url=new URL(r.original_url);if(url.origin!=='https://edgedirect2u.com.ng'||!url.pathname.startsWith('/storage/app/public/product/'))throw Error('Unexpected source');
   const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok||Number(response.headers.get('content-length'))>5242880)throw Error('Source photo unavailable');
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5242880)throw Error('Photo too large');
   const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;if(!mime)throw Error('Unsupported photo bytes');
   const hash=crypto.createHash('sha256').update(bytes).digest('hex'),path=`legacy-products/${hash}.${mime.split('/')[1]}`;
   const upload=await storage.upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'31536000'});
   const publicUrl=storage.getPublicUrl(path).data.publicUrl;
   if(upload.error){if(String(upload.error.statusCode)!=='409')throw Error('Photo upload failed');const existing=await fetch(publicUrl,{signal:AbortSignal.timeout(20000)});if(!existing.ok||crypto.createHash('sha256').update(Buffer.from(await existing.arrayBuffer())).digest('hex')!==hash)throw Error('Existing photo checksum mismatch');}
   await db.query('begin');try{
    await db.query('insert into branding_assets(path,owner_id,mime,size_bytes) values($1,$2,$3,$4) on conflict(path) do nothing',[path,owner.id,mime,bytes.length]);
    const result=await db.query('update products set image=$1 where id=$2 and image=$3',[publicUrl,r.product_id,r.original_url]);
    await db.query("update legacy_catalogue_source set source_data=source_data||jsonb_build_object('rehosted_url',$1::text,'photo_sha256',$2::text) where product_id=$3",[publicUrl,hash,r.product_id]);
    await db.query('commit');attached+=result.rowCount;
   }catch(e){await db.query('rollback');throw e;}
  }catch{failures.push(r.product_id);}}
  await db.query("insert into platform_audit(company_id,actor,action,detail) values('10000000-0000-4000-8000-000000000001',$1,'legacy.catalogue.photos',$2)",[owner.id,{attached,preserved,failures}]);
  console.log(JSON.stringify({attached,existing_or_admin_changes_preserved:preserved,failed_products:failures}));if(failures.length)process.exitCode=1;
 }finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('Photo migration failed: '+e.message);process.exitCode=1;});
module.exports={main};
