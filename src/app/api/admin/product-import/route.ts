import {NextResponse} from 'next/server';
import {z} from 'zod';
import {guard,failure} from '@/lib/http';
import {requireRole,supabase} from '@/lib/server';
import {parseImportCsv} from '@/lib/product-import';
export async function POST(req:Request){try{
 guard(req);await requireRole(['admin']);const text=await req.text();if(text.length>1_200_000)throw Error('Import is too large');
 const input=z.object({csv:z.string().max(1_000_000),mode:z.enum(['skip','update']),apply:z.boolean().default(false),tokens:z.array(z.string().regex(/^[a-f0-9]{32}$/)).max(250).optional()}).strict().parse(JSON.parse(text));
 const parsed=parseImportCsv(input.csv);if(parsed.some(r=>r.error))return NextResponse.json({errors:parsed.filter(r=>r.error).length,rows:parsed.map(r=>({slug:r.slug,line:r.line,error:r.error,action:'Fix CSV row'})),tokens:[],applied:false});
 const {data,error}=await(await supabase()).rpc('admin_import_products',{p_rows:parsed.map(r=>r.data),p_mode:input.mode,p_apply:input.apply,p_expected:input.tokens||null});
 if(error)throw Error(error.message);return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
