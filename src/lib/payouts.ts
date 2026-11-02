import {z} from 'zod';
export const payoutKind=z.enum(['merchant','staff']);
const payee=z.object({bank_name:z.string().trim().min(2).max(100),account_name:z.string().trim().min(2).max(100),account_number:z.string().regex(/^[0-9]{10}$/)}).strict();
export const payoutAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('request'),id:z.uuid(),kind:payoutKind,company:z.uuid().nullable(),amount:z.number().int().min(1).max(100_000_000_000),payee,note:z.string().trim().min(10).max(500)}).strict(),
 z.object({action:z.literal('review'),id:z.uuid(),decision:z.enum(['approve','reject','paid']),note:z.string().trim().min(5).max(500),reference:z.string().max(150).default(''),checked:z.boolean().default(false)}).strict(),
 z.object({action:z.literal('cancel'),id:z.uuid()}).strict(),
]);
export type PayoutContext={kind:'merchant'|'staff';company:string|null;can_request:boolean;can_review:boolean;balance_kobo:number|null};
export type PayoutRow={id:string;kind:string;owner_id:string;requester:string;merchant_id:string|null;company_id:string|null;amount_kobo:number;payee:{bank_name:string;account_name:string;account_number:string};note:string;status:string;review_note:string;payment_reference:string|null;paid_at:string|null;created_at:string};
