import {NextResponse} from 'next/server';
import {z} from 'zod';
import {platformIdentity} from '@/lib/platform-server';
import {failure} from '@/lib/http';
import {csv} from '@/lib/business';
import type {FieldDirectory} from '@/lib/field-directory';
export async function GET(req:Request){try{
 const query=new URL(req.url).searchParams;
 const input=z.object({company:z.uuid(),q:z.string().max(120),route:z.string().max(250),location:z.enum(['all','ready','missing']),page:z.coerce.number().int().min(1).max(100000)}).parse({company:query.get('company'),q:query.get('q')||'',route:query.get('route')||'',location:query.get('location')||'all',page:query.get('page')||1});
 const {db}=await platformIdentity();const exporting=query.get('format')==='csv';
 const get=async(page:number)=>{const {data,error}=await db.rpc('field_store_directory',{p_company:input.company,p_query:input.q,p_route:input.route,p_location:input.location,p_page:page});if(error)throw new Error(error.message);return data as FieldDirectory;};
 const data=await get(exporting?1:input.page);
 if(!exporting)return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 const rows=[...data.rows];for(let page=2;rows.length<data.count;page++){if(req.signal.aborted)throw new Error('Export cancelled');const next=await get(page);if(!next.rows.length||next.count!==data.count)throw new Error('Directory changed during export. Please retry.');rows.push(...next.rows);}
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Directory changed during export. Please retry.');
 return new Response(csv([['Customer ID','Outlet ID','Name','Address','Phone','Route','Latitude','Longitude'],...rows.map(r=>[r.legacy_customer_id??null,r.id,r.name,r.address,r.phone??null,r.route??null,r.latitude,r.longitude])]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="assigned-customer-outlets.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return failure(e);}}
