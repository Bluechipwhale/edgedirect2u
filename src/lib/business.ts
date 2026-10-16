import { z } from 'zod';

const id = z.string().min(1).max(150);
const reason = z.string().trim().min(10).max(500);
export const businessAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('access'), email: z.email().max(254), role: z.enum(['warehouse_manager','it_manager','accounts','client','van_sales']), principal: id.nullable(), active: z.boolean() }).refine(v=>v.role!=='client'||!!v.principal,{path:['principal'],message:'Choose a supplier for client access'}),
  z.object({ action: z.literal('stock'), id:z.uuid(), product: id, quantity: z.number().int().min(-1000000).max(1000000).refine(n=>n!==0), reason }),
  z.object({ action: z.literal('transfer'), id:z.uuid(), seller: z.uuid(), product: id, quantity: z.number().int().min(-1000000).max(1000000).refine(n=>n!==0), reason }),
  z.object({ action: z.literal('sale'), id: z.uuid(), product: id, quantity: z.number().int().min(1).max(10000), note: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal('cash'), sale: z.uuid() }),
  z.object({ action: z.literal('map'), product: id, principal: id.nullable() }),
]);
export const roleLabels: Record<string,string> = { administrator:'Administration', warehouse_manager:'Warehouse manager', it_manager:'IT manager', accounts:'Accounts', client:'Client reporting', van_sales:'Van sales' };
export type BusinessContext = { role: string; principal: string|null };
export type InventoryRow = { id:string;image:string;name:string;brand:string;active:boolean;stock:number;reserved:number;available:number;van_stock:number;principal_id:string|null;principal:string|null;benchmark_price_kobo:number|null;source:string|null;verified_on:string|null };
export type VanSale = { id:string;product:string;seller_id:string;salesperson:string;quantity:number;amount_kobo:number;created_at:string;cash_confirmed_at:string|null };
export type BusinessReport = { role:string;from:string;to:string;inventory?:InventoryRow[];sellers?:{id:string;email:string}[];movements?:{id:string;name:string;quantity:number;reason:string;created_at:string}[];finance?:{verified_payments_kobo:number;processed_refunds_kobo:number;settlements:{id:string;merchant_id:string;amount_kobo:number;reference:string;status:string;created_at:string}[]};van_sales?:VanSale[];online_sales?:{product_id:string;name:string;quantity:number;gross_kobo:number}[];van_stock?:{id:string;name:string;quantity:number;price_kobo:number;active:boolean}[] };
export type BusinessTeam = { members:{email:string;role:string;principal_id:string|null;active:boolean;claimed:boolean;confirmed:boolean}[];principals:{id:string;name:string}[] };
// Prevent a product name or other external text from becoming an Excel formula.
export function csv(rows:(string|number|null)[][]){return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
