import {requireRole,supabase,localMode,records} from '@/lib/server';
import {csv} from '@/lib/business';
import {failure} from '@/lib/http';
export async function GET(req:Request){try{
 const actor=await requireRole(['driver']);
 let rows:{id:string;created_at:string;data:Record<string,unknown>}[]=[];
 if(await localMode())rows=(await records('deliveries')).filter(r=>r.data.driver_id===actor.id);
 else{const db=await supabase();let total:number|null=null;
  for(let offset=0;total===null||offset<total;offset+=1000){const r=await db.from('operational_records').select('id,created_at,data',{count:'exact'}).eq('kind','deliveries').eq('owner_id',actor.id).order('created_at',{ascending:false}).order('id').range(offset,offset+999).abortSignal(req.signal);if(r.error)throw new Error('Delivery export unavailable');if(total!==null&&r.count!==total)throw new Error('Deliveries changed during export. Please retry.');total=r.count||0;rows.push(...r.data||[]);if(!r.data?.length&&offset<total)throw new Error('Incomplete export. Please retry.');}
 }
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Deliveries changed during export. Please retry.');
 return new Response(csv([['Delivery ID','Order ID','Status','Assigned at'],...rows.map(r=>[r.id,String(r.data.order_id),String(r.data.status),r.created_at])]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="my-deliveries.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(error){return failure(error);}}
