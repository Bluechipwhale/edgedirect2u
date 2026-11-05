import {z} from 'zod';
const money=z.number().int().positive().max(100_000_000_000);
const item=z.object({product_id:z.string().min(1).max(100),quantity:z.number().int().min(1).max(50),options:z.record(z.string().max(60),z.string().max(500)).default({})}).strict();
export const posAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('reserve'),id:z.uuid(),buyer:z.object({name:z.string().trim().min(2).max(100),email:z.union([z.literal(''),z.email()]).default(''),phone:z.string().max(40).default('')}).strict(),method:z.enum(['cash','bank_transfer','paystack']),items:z.array(item).min(1).max(50)}).strict(),
 z.object({action:z.literal('confirm'),id:z.uuid(),amount:money,tender:money,reference:z.string().max(150),note:z.string().trim().min(3).max(500),checked:z.literal(true)}).strict(),
 z.object({action:z.literal('cancel'),id:z.uuid()}).strict(),
 z.object({action:z.literal('initialize'),id:z.uuid()}).strict(),
 z.object({action:z.literal('verify'),id:z.uuid()}).strict(),
 z.object({action:z.literal('refund'),id:z.uuid(),sale:z.uuid(),amount:money,reference:z.string().min(6).max(150),note:z.string().trim().min(10).max(500),checked:z.literal(true)}).strict(),
 z.object({action:z.literal('reconcile_refund'),id:z.uuid(),sale:z.uuid(),amount:money,provider:z.string().regex(/^[0-9]+$/)}).strict(),
]);
export type PosReceipt={amount_kobo:number;tender_kobo:number;external_reference:string;confirmed_at:string;note:string};
export type PosSale={id:string;created_by:string;buyer:{name:string;email:string;phone:string};method:'cash'|'bank_transfer'|'paystack';status:string;total_kobo:number;reference:string;expires_at:string;created_at:string;pos_items:{id:string;product_id:string;name:string;quantity:number;price_kobo:number;options:Record<string,string>}[];pos_receipts:PosReceipt|PosReceipt[]|null;pos_refunds:{id:string;amount_kobo:number;external_reference:string;note:string;confirmed_at:string}[]};
// sale_id is the receipt's primary key: PostgREST embeds a one-to-one object.
// Older callers can still supply the previously declared array shape.
export function getPosReceipt(sale:Pick<PosSale,'pos_receipts'>):PosReceipt|null {
 return Array.isArray(sale.pos_receipts)?sale.pos_receipts[0]??null:sale.pos_receipts??null;
}
export const posSelection='*,pos_items(*),pos_receipts(*),pos_refunds(*)';
export const posFilter=z.object({from:z.iso.date(),to:z.iso.date(),method:z.enum(['','cash','bank_transfer','paystack']).default(''),status:z.enum(['','reserved','paid','cancelled','expired','refunded']).default('')}).refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000,'Choose a period of up to 366 days');
export function posDates(from:string,to:string){return {from:from+'T00:00:00+01:00',until:new Date(Date.parse(to+'T00:00:00+01:00')+86400000).toISOString()};}
