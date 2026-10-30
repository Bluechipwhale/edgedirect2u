import {localMode,requireRole,supabase} from '@/lib/server';
import {customerCsvCell} from '@/lib/customer-csv';
import {text,type HistoryPage} from '@/lib/legacy-history';

export async function GET(request:Request){
 try{
  await requireRole(['admin']);
  if(await localMode())return new Response('History export requires Supabase',{status:503});
  const params=new URL(request.url).searchParams,table=params.get('table')||'orders',batch=params.get('batch'),query=(params.get('q')||'').trim().slice(0,120);
  if(!/^[a-z][a-z0-9_]{0,63}$/.test(table)||!batch||!/^[a-f0-9]{64}$/.test(batch))return new Response('Invalid export',{status:400});
  const db=await supabase();
  const read=async(page:number)=>{const {data,error}=await db.rpc('admin_legacy_history',{p_table:table,p_query:query,p_page:page,p_batch:batch,p_limit:1000});if(error)throw Error('History export unavailable');return data as HistoryPage;};
  const first=await read(1);if(!first.batch)return new Response('Archive unavailable',{status:404});
  // SQL source rows have a fixed schema. Stream bounded pages with backpressure
  // so the 51,844-order export does not exhaust a shared host's memory. Abort the
  // download on any inconsistent/missing page rather than closing a partial CSV.
  const columns=Object.keys(first.rows[0]?.data||{}).sort(),encoder=new TextEncoder();
  let page=1,exported=0;
  const stream=new ReadableStream<Uint8Array>({
   start(controller){controller.enqueue(encoder.encode('\ufeff'+['Source site','Snapshot date','Source table','Source ID',...columns].map(customerCsvCell).join(',')+'\r\n'));},
   async pull(controller){
    try{
     const next=page===1?first:await read(page);
     if(next.count!==first.count||(!next.rows.length&&exported<first.count)||next.rows.some(r=>JSON.stringify(Object.keys(r.data).sort())!==JSON.stringify(columns)))throw Error('Incomplete export');
     exported+=next.rows.length;if(exported>first.count)throw Error('Archive count changed');
     if(next.rows.length)controller.enqueue(encoder.encode(next.rows.map(r=>[first.batch!.source_site,first.batch!.snapshot_date,table,r.source_id,...columns.map(c=>text(r.data[c]))].map(customerCsvCell).join(',')).join('\r\n')+'\r\n'));
     page++;if(exported===first.count)controller.close();
    }catch{controller.error(new Error('History export interrupted; retry the download'));}
   },
  });
  return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="former-store-${table}.csv"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }catch{return new Response('History export unavailable; sign in with an administrator account and retry',{status:403,headers:{'Cache-Control':'private, no-store'}});}
}
