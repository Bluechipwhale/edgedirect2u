import {NextResponse} from 'next/server';
import {requireRole,supabase,adminProductCatalogue} from '@/lib/server';
import {guard,failure} from '@/lib/http';
import {dealInput} from '@/lib/deals';
export async function GET(req:Request){try{const a=await requireRole(['admin']);const q=(new URL(req.url).searchParams.get('q')||'').trim().slice(0,100);if(q.length<2)return NextResponse.json([]);const r=await adminProductCatalogue(a,1,q);return NextResponse.json(r.products.filter(p=>!p.archived_at).map(p=>({id:p.id,name:p.name,price:p.price_kobo})),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{guard(req);await requireRole(['admin']);const body=await req.text();if(body.length>4000)throw Error('Request too large');const i=dealInput.parse(JSON.parse(body)),r=await(await supabase()).rpc('save_product_deal',{p_id:i.id,p_product:i.product,p_kind:i.kind,p_title:i.title,p_price:i.price,p_start:i.start,p_end:i.end,p_active:i.active});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true});}catch(e){return failure(e);}}
