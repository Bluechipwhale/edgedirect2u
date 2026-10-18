// Merchandising categories from explicit product names; source categories remain private provenance.
const category=name=>{
 const n=name.toUpperCase();
 if(/CUSSONS?\s*BABY|CHILDS FARM|RAFFERTY/.test(n))return 'fmcg-baby-care-products';
 if(/MORNING\s*FRESH/.test(n))return 'fmcg-household-cleaning-products';
 if(/CANOE|ZIP\s*(DET|DETERGENT)/.test(n))return 'fmcg-laundry-and-fabric-care';
 if(/MAMADOR/.test(n))return 'fmcg-cooking-oils-and-condiments';
 if(/HOLLANDIA/.test(n))return 'fmcg-dairy-products';
 if(/LIPTON/.test(n))return 'fmcg-non-alcoholic-drinks';
 if(/^OAT\s/.test(n))return 'fmcg-food-and-beverages';
 if(/CAREX|PREMIER|JOY SOAP|IMPERIAL|IL CLASSIC BAR|VENUS|SANCTUARY|TROPEZ|CHARLES|FUDGE|ORIGINAL SOURCE|CUSSONS?\s*KIDS|BAYLEY|JET HAIRCREAM|DANDUALLA/.test(n))return 'fmcg-personal-care-and-hygiene';
 return null;
};
async function main(){
 require('@next/env').loadEnvConfig(process.cwd());const fs=require('node:fs'),{Client}=require('pg');
 const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
 try{await db.connect();const rows=(await db.query('select p.id,p.name,p.category_id,s.source_data from products p join legacy_catalogue_source s on s.product_id=p.id')).rows;
  const plan=rows.map(r=>({...r,target:category(r.name)})).filter(r=>r.target&&r.category_id.startsWith('legacy-category-'));
  console.log(JSON.stringify({source_products:rows.length,categories:plan.reduce((o,r)=>(o[r.target]=(o[r.target]||0)+1,o),{}),unchanged:rows.length-plan.length,mode:process.argv.includes('--apply')?'apply':'plan'}));if(!process.argv.includes('--apply'))return;
  if(rows.length!==231)throw Error('Full catalogue import must finish first');
  await db.query('begin');try{
   const owner=(await db.query("select p.id from profiles p join auth.users u on p.id=u.id where p.role='admin' and lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null")).rows[0];if(!owner)throw Error('Confirmed owner required');
   const result=await db.query(`update products p set category_id=x.target from jsonb_to_recordset($1::jsonb) x(id text,category_id text,target text) where p.id=x.id and p.category_id=x.category_id returning p.id`,[JSON.stringify(plan.map(r=>({id:r.id,category_id:r.category_id,target:r.target})))]);
   await db.query("insert into platform_audit(company_id,actor,action,detail) values('10000000-0000-4000-8000-000000000001',$1,'legacy.catalogue.categories',$2)",[owner.id,{changed:result.rowCount,prices_changed:0,stock_changed:0,publication_changed:false,original_categories:'Retained in legacy_catalogue_source.source_data.category_ids'}]);
   await db.query('commit');console.log(JSON.stringify({categorized:result.rowCount}));
  }catch(e){await db.query('rollback');throw e;}
 }finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('Catalogue organization failed: '+e.message);process.exitCode=1;});
module.exports={main,category};
