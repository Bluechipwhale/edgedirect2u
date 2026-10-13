import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor,requireRole,localMode,supabase,records,orders } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import { resourceSchemas,productSchema } from '@/lib/resources';
import { guard,failure } from '@/lib/http';
import type { Product,Category,RecordRow } from '@/lib/types';
export async function POST(req:Request){try{guard(req);const a=(await actor())!;const input=z.object({kind:z.string().max(60),id:z.string().max(100).optional(),data:z.record(z.string(),z.unknown())}).parse(await req.json());const schema=input.kind==='products'?productSchema:resourceSchemas[input.kind];if(!schema)throw new Error('Unknown resource');const data=schema.parse(input.data) as Record<string,unknown>;
  if(['addresses','returns','reviews'].includes(input.kind)){if(input.kind==='returns'||input.kind==='reviews'){const o=(await orders(a)).find(o=>o.id===data.order_id);if(!o||o.payment_status!=='paid')throw new Error('Only verified paid orders are eligible');if(a.role!=='admin')data.status=input.kind==='returns'?'requested':'pending';if(input.kind==='reviews'&&!o.items.some(i=>i.product_id===data.product_id))throw new Error('Product was not purchased in this order');}}
  else if(a.role==='merchant' && input.kind==='products'){data.merchant_id=a.merchantId;const m=(await records('merchants')).find(m=>m.id===a.merchantId);if(m?.data.status!=='approved')throw new Error('Merchant approval required');data.merchant_name=m.data.name;}
  else await requireRole(['admin']);
  const id=input.id||crypto.randomUUID();
  if(await localMode()){const store=localStore();if(input.kind==='products'){const existing=store.get<Product>('products',id);if(a.role==='merchant'&&existing&&existing.merchant_id!==a.merchantId)throw new Error('Forbidden');store.put('products',id,{...data,id,stock:existing?.stock||0,reserved:existing?.reserved||0,created_at:existing?.created_at||new Date().toISOString()});}else if(input.kind==='categories'){store.put('categories',id,{...data,id} as Category);}else{const existing=store.get<RecordRow>(input.kind,id);if(existing&&a.role!=='admin'&&existing.owner_id!==a.id)throw new Error('Forbidden');store.record(input.kind,data,id,a);}store.audit(a,`${input.kind}.saved`,{id});}
  else {const db=await supabase();if(input.kind==='products'){const {error}=await db.rpc('save_product',{p_id:id,p_data:data});if(error)throw new Error(error.message);}else if(input.kind==='categories'){const {error}=await db.from('categories').upsert({...data,id,parent_id:data.parent_id||null});if(error)throw new Error(error.message);}else{const {error}=await db.rpc('save_record',{p_kind:input.kind,p_id:id,p_data:data});if(error)throw new Error(error.message);}}
  return NextResponse.json({ok:true,id});}catch(e){return failure(e);}}

