import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole,localMode,supabase,actor,orders,records } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import { guard,failure } from '@/lib/http';
import type { Order } from '@/lib/types';
export async function POST(req:Request){try{guard(req);const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('stock'),product_id:z.string(),quantity:z.number().int(),reason:z.string().min(3).max(500)}),
  z.object({action:z.literal('dispatch'),order_id:z.string(),driver_id:z.string()}),
  z.object({action:z.literal('delivery'),id:z.string(),status:z.enum(['assigned','picked_up','in_transit','delivered','failed']),note:z.string().max(1000).default(''),proof:z.string().max(500).default('')}),
  z.object({action:z.literal('order'),id:z.string(),status:z.enum(['processing','ready_for_dispatch'])}),
  z.object({action:z.literal('refund'),id:z.string(),amount:z.number().int().positive()}),
]).parse(await req.json());const a=(await actor())!;const local=await localMode();
  if(input.action==='stock'){await requireRole(['admin','operations','merchant']);if(local)localStore().adjustStock(a,input.product_id,input.quantity,input.reason);else{const {error}=await(await supabase()).rpc('adjust_stock',{p_product:input.product_id,p_quantity:input.quantity,p_reason:input.reason});if(error)throw new Error(error.message);}}
  if(input.action==='dispatch'){await requireRole(['admin','operations']);const o=(await orders(a)).find(o=>o.id===input.order_id);if(!o||o.payment_status!=='paid'||o.status!=='ready_for_dispatch')throw new Error('Only paid, ready orders may be assigned');const driver=(await records('drivers')).find(d=>d.data.user_id===input.driver_id&&d.data.available);if(!driver)throw new Error('Select an available driver');if(local){const store=localStore();store.transaction(()=>{if(store.list<{data:Record<string,unknown>}>('deliveries').some(d=>d.data.order_id===o.id))throw new Error('Order already dispatched');store.record('deliveries',{order_id:o.id,driver_id:input.driver_id,status:'assigned',address:o.address});store.audit(a,'delivery.assigned',{order_id:o.id,driver_id:input.driver_id});});}else{const {error}=await(await supabase()).rpc('assign_delivery',{p_order:o.id,p_driver:input.driver_id});if(error)throw new Error(error.message);}}
  if(input.action==='delivery'){await requireRole(['admin','operations','driver']);if(local)localStore().delivery(a,input.id,input.status,input.note,input.proof);else{const {error}=await(await supabase()).rpc('update_delivery',{p_id:input.id,p_status:input.status,p_note:input.note,p_proof:input.proof});if(error)throw new Error(error.message);}}
  if(input.action==='order'){await requireRole(['admin','operations']);if(local){const store=localStore();store.transaction(()=>{const o=store.get<Order>('orders',input.id);if(!o||o.payment_status!=='paid'||o.status!=='processing'||input.status!=='ready_for_dispatch')throw new Error('Invalid order transition');o.status=input.status;store.put('orders',o.id,o);store.audit(a,'order.ready',{id:o.id});});}else{const {error}=await(await supabase()).rpc('ready_order',{p_order:input.id});if(error)throw new Error(error.message);}}
  if(input.action==='refund'){await requireRole(['admin']);if(local)localStore().refund(a,input.id,input.amount);else{const {error}=await(await supabase()).rpc('request_refund',{p_order:input.id,p_amount:input.amount});if(error)throw new Error(error.message);}}
  return NextResponse.json({ok:true});}catch(e){return failure(e);}}
