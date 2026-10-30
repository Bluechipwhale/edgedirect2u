import {actor,supabase} from '@/lib/server';
import {failure} from '@/lib/http';
import {csv} from '@/lib/business';
export async function GET(req:Request){try{
 await actor();const query=new URL(req.url).searchParams,db=await supabase(),ticket=query.get('ticket'),status=query.get('status')||'';const out:Record<string,unknown>[]=[];let total:number|undefined;
 for(let page=1;total===undefined||out.length<total;page++){
  if(req.signal.aborted)throw Error('Export cancelled');const {data,error}=ticket?await db.rpc('support_thread',{p_id:ticket,p_page:page}):await db.rpc('support_inbox',{p_page:page,p_status:status});if(error)throw Error('Support export unavailable');
  const rows=ticket?data.messages:data.rows;if(total!==undefined&&total!==data.count)throw Error('Conversation changed during export. Please retry.');total=data.count;if(!rows.length&&out.length<(total||0))throw Error('Incomplete export');out.push(...rows);if(!total)break;
 }
 if(new Set(out.map(r=>r.id)).size!==out.length)throw Error('Records changed during export. Please retry.');const keys=ticket?['id','staff','body','created_at']:['id','name','email','subject','status','created_at','updated_at'];return new Response(csv([keys,...out.map(r=>keys.map(k=>r[k]==null?'':String(r[k])))]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="support.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return failure(e);}}
