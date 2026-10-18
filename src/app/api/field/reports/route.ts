import {NextResponse} from 'next/server';
import {z} from 'zod';
import {platformIdentity} from '@/lib/platform-server';
import {failure} from '@/lib/http';
import {csv} from '@/lib/business';
import type {FieldReport} from '@/lib/field-report';
export async function GET(req:Request){try{
 const params=new URL(req.url).searchParams;
 const input=z.object({company:z.uuid(),from:z.iso.date(),to:z.iso.date(),agent:z.union([z.uuid(),z.literal('')]).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),format:z.enum(['json','csv']).default('json')}).parse(Object.fromEntries(params));
 const {db}=await platformIdentity();
 const get=async(page:number)=>{const {data,error}=await db.rpc('field_daily_report',{p_company:input.company,p_from:input.from,p_to:input.to,p_agent:input.agent||null,p_page:page});if(error)throw new Error(error.message);return data as FieldReport;};
 const report=await get(input.format==='csv'?1:input.page);
 if(input.format==='json')return NextResponse.json(report,{headers:{'Cache-Control':'private, no-store'}});
 // Export all filtered pages, preserving the same role checks on every query.
 const rows=[...report.rows];for(let page=2;rows.length<report.count;page++){if(req.signal.aborted)throw new Error('Export cancelled');const next=await get(page);if(!next.rows.length||next.count!==report.count||JSON.stringify(next.summary)!==JSON.stringify(report.summary))throw new Error('Data changed during export. Please retry.');rows.push(...next.rows);}
 if(new Set(rows.map(row=>row.assignment_id)).size!==rows.length)throw new Error('Data changed during export. Please retry.');
 const values:(string|number|null)[][]=[['Period from',report.from,'Period to',report.to,'Timezone',report.timezone],['Assigned visits',report.summary.assigned,'Visited outlets',report.summary.visited,'Completed reports',report.summary.completed,'Remaining',report.summary.remaining],['Sales amount (NGN)',report.sales.amount_kobo/100,'Units sold',report.sales.units],[],['Visit date','Salesperson','Customer ID','Outlet','Address','Phone','Route','Status','Started at','Completed at','Supervisor exception','Notes']];
 for(const row of rows)values.push([row.visit_date,row.salesperson,row.legacy_customer_id,row.outlet,row.address,row.phone,row.route,row.status,row.started_at,row.completed_at,row.override_reason,row.notes]);
 return new Response(csv(values),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="vsr-visits-${input.from}-${input.to}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(error){return failure(error);}}
