// Private deployment operation. Old SQL is parsed as data, never executed.
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto'),path=require('node:path');
const {parseDump}=require('./inspect-legacy-export.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const forbiddenTable=/^(admins|admin_roles|business_settings|soft_credentials|password_resets|oauth_|personal_access_tokens|phone_or_email_verifications|jobs|failed_jobs|migrations|translations|sessions|cache)/;
const forbiddenField=/password|token|card_|social_id|remember|secret|api_key|verification_code|confirm_payCode|^payCode$|identity_number|identity_image|^account_no$|^holder_name$|^bank_name$|^branch$/i;
function sanitize(value){
 if(Array.isArray(value))return value.map(sanitize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!forbiddenField.test(key)).map(([key,v])=>[key,sanitize(v)]));
 if(typeof value==='string'&&/^[\[{]/.test(value)){try{return JSON.stringify(sanitize(JSON.parse(value)));}catch{}}
 return value;
}
function prepare(bytes,snapshotDate){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate))throw Error('Explicit snapshot date required');
 const sql=zlib.gunzipSync(bytes).toString('utf8');
 const tables=[...sql.matchAll(/CREATE TABLE `([^`]+)`/g)].map(m=>m[1]);
 const allowed=tables.filter(t=>!forbiddenTable.test(t));
 const parsed=parseDump(sql,new Set(allowed));const rows=[],counts={};
 for(const t of allowed){const seen=new Set();counts[t]=(parsed.tables[t]||[]).length;
  for(const original of parsed.tables[t]||[]){
   const data=sanitize(original),sourceId=String(data.id??data.id_no??data.route_id??'');
   if(!sourceId||sourceId.length>150||seen.has(sourceId))throw Error('Missing or duplicate source key in '+t);
   seen.add(sourceId);rows.push({source_table:t,source_id:sourceId,data,checksum:sha(JSON.stringify(data))});
  }
 }
 const orders=parsed.tables.orders||[],details=parsed.tables.order_details||[],headers=new Set(orders.map(r=>r.id)),withLines=new Set(details.map(r=>r.order_id)),users=new Set((parsed.tables.users||[]).map(r=>r.id));
 const reconciliation={orders:orders.length,order_details:details.length,orders_with_details:orders.filter(r=>withLines.has(r.id)).length,orders_without_details:orders.filter(r=>!withLines.has(r.id)).length,orphan_detail_rows:details.filter(r=>!headers.has(r.order_id)).length,orders_customer_missing:orders.filter(r=>r.customer_id&&!users.has(r.customer_id)).length,payment_receipts:(parsed.tables.order_transactions||[]).length,policy:'Historical source claims only; no live revenue, stock, balances, account access or messaging replayed'};
 return {id:sha(bytes),source_site:'edgedirect2u.com.ng',snapshot_date:snapshotDate,counts,reconciliation,rows,excluded_tables:tables.filter(t=>forbiddenTable.test(t))};
}
async function main(){
 const opt=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
 const file=fs.realpathSync(opt('file')||''),root=fs.realpathSync('.data')+path.sep;
 if(!file.toLowerCase().startsWith(root.toLowerCase()))throw Error('Export must remain in ignored .data');
 const batch=prepare(fs.readFileSync(file),opt('date')||'');
 const expected=opt('sha256');if(expected!==batch.id)throw Error('Explicit export --sha256 must match');
 const dir=path.dirname(file);fs.writeFileSync(path.join(dir,'prepared-history.json'),JSON.stringify(batch));
 console.log(JSON.stringify({source_sha256:batch.id,tables:Object.keys(batch.counts).length,records:batch.rows.length,reconciliation:batch.reconciliation,mode:process.argv.includes('--apply')?'apply':'plan'}));
 if(!process.argv.includes('--apply'))return;
 require('@next/env').loadEnvConfig(process.cwd());const {Client}=require('pg');
 const connection=new URL(process.env.DATABASE_URL);
 if(process.argv.includes('--pooler')){connection.hostname='aws-0-eu-west-1.pooler.supabase.com';connection.port='5432';connection.username='postgres.itdpkfnuyxzqswctlsar';}
 const db=new Client({connectionString:connection.toString(),connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
 try{
  await db.connect();await db.query('begin isolation level repeatable read');await db.query("select pg_advisory_xact_lock(hashtext('edge-legacy-history'))");
  const owner=(await db.query("select p.id from profiles p join auth.users u on u.id=p.id where p.role='admin' and lower(u.email)='olasodechukwudi@gmail.com' and u.email_confirmed_at is not null")).rows[0];if(!owner)throw Error('Confirmed owner required');
  // Back up the destination datasets this operation must not alter, then compare
  // complete row fingerprints in the same consistent, repeatable-read snapshot.
  const liveTables=['orders','order_items','payments','stock_movements','products','legacy_customers','field_stores','legacy_catalogue_source'];
  const before={};for(const t of liveTables){const r=await db.query('select * from '+t+' order by 1');before[t]=r.rows;}
  fs.writeFileSync(path.join(dir,'destination-before.json'),JSON.stringify({created_at:new Date().toISOString(),tables:before}));
  await db.query('insert into legacy_history_batches(id,source_site,snapshot_date,counts,reconciliation) values($1,$2,$3,$4,$5) on conflict(id) do nothing',[batch.id,batch.source_site,batch.snapshot_date,batch.counts,batch.reconciliation]);
  let inserted=0;
  for(let i=0;i<batch.rows.length;i+=250){const chunk=batch.rows.slice(i,i+250);
   const old=await db.query('select source_table,source_id,checksum from legacy_history_records where batch_id=$1 and (source_table,source_id) in (select x.source_table,x.source_id from jsonb_to_recordset($2::jsonb) x(source_table text,source_id text))',[batch.id,JSON.stringify(chunk)]);
   const byKey=new Map(chunk.map(r=>[r.source_table+':'+r.source_id,r.checksum]));
   if(old.rows.some(r=>byKey.get(r.source_table+':'+r.source_id)!==r.checksum))throw Error('Existing archive conflict');
   const result=await db.query('insert into legacy_history_records(batch_id,source_table,source_id,data,checksum) select $1,x.source_table,x.source_id,x.data,x.checksum from jsonb_to_recordset($2::jsonb) x(source_table text,source_id text,data jsonb,checksum text) on conflict do nothing',[batch.id,JSON.stringify(chunk)]);inserted+=result.rowCount;
  }
  // Verify all fields, not only stored checksum columns. JSONB key ordering does
  // not matter; values, nulls and exact decimal strings must match.
  let verified=0;for(const [t,n] of Object.entries(batch.counts)){
   const actual=(await db.query('select source_id,data,checksum from legacy_history_records where batch_id=$1 and source_table=$2',[batch.id,t])).rows;
   const expectedRows=new Map(batch.rows.filter(r=>r.source_table===t).map(r=>[r.source_id,r]));
   const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
   if(actual.length!==n||actual.some(r=>!expectedRows.has(r.source_id)||r.checksum!==expectedRows.get(r.source_id).checksum||JSON.stringify(canonical(r.data))!==JSON.stringify(canonical(expectedRows.get(r.source_id).data))))throw Error('Post-import data mismatch in '+t);
   verified+=actual.length;
  }
  for(const t of liveTables){const after=(await db.query('select * from '+t+' order by 1')).rows;if(sha(JSON.stringify(before[t]))!==sha(JSON.stringify(after)))throw Error('Protected live table changed: '+t);}
  await db.query('update legacy_history_batches set verified_at=now() where id=$1',[batch.id]);
  await db.query("insert into audit_logs(actor,action,detail) values($1,'legacy.history.import',$2)",[owner.id,{source_sha256:batch.id,records:verified,inserted,counts:batch.counts,live_records_changed:0}]);
  await db.query('commit');
  const receipt={completed_at:new Date().toISOString(),source_sha256:batch.id,verified_records:verified,inserted,already_present:verified-inserted,counts:batch.counts,reconciliation:batch.reconciliation,protected_live_tables_unchanged:liveTables,source_deletions:0,destination_deletions:0};
  fs.writeFileSync(path.join(dir,'supabase-verification.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({verified_records:verified,inserted,live_records_changed:0}));
 }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
}
if(require.main===module)main().catch(e=>{console.error('History import failed: '+e.message);process.exitCode=1;});
module.exports={prepare,sanitize};
