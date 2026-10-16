import {localMode,requireRole,supabase} from '@/lib/server';
import {customerCsvCell} from '@/lib/customer-csv';

type CustomerExportRow={
  source_id:string;name:string;email:string;phone:string;route:string;
  legacy_order_count:number|null;legacy_verified:boolean;truncated_name:boolean;linked:boolean;
  street:string|null;city:string|null;state:string|null;
};
const headers=['Legacy ID','Customer name','Name shortened in former store','Email','Phone','Route','Old order count','Verified on former store','Linked new account','Street','City','State'];

export async function GET(){
  try{
    await requireRole(['admin']);
    if(await localMode())return new Response('Customer export requires Supabase',{status:503});
    const {data,error}=await(await supabase()).rpc('admin_legacy_customers_export');
    if(error||!Array.isArray(data))throw new Error('Unavailable');
    const records=data as CustomerExportRow[];
    const lines=[headers.map(customerCsvCell).join(','),...records.map(row=>[
      row.source_id,row.name,row.truncated_name?'Yes':'No',row.email,row.phone,row.route,row.legacy_order_count,
      row.legacy_verified?'Yes':'No',row.linked?'Yes':'No',row.street,row.city,row.state,
    ].map(customerCsvCell).join(','))];
    return new Response('\ufeff'+lines.join('\r\n')+'\r\n',{headers:{
      'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':'attachment; filename="edgedirect2u-former-store-customers.csv"',
      'Cache-Control':'private, no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
    }});
  }catch{return new Response('Customer export unavailable',{status:403,headers:{'Cache-Control':'private, no-store'}});}
}
