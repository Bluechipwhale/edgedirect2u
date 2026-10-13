import 'server-only';
import { z } from 'zod';
import { paystack } from './paystack';
const providerRefund=z.object({id:z.number().int().positive(),amount:z.number().int().positive(),currency:z.literal('NGN'),transaction:z.union([z.number().int().positive(),z.object({reference:z.string()})]),status:z.enum(['pending','processing','processed','failed','needs-attention'])});
export function validateRefund(raw:unknown,expected:{amount:number;reference:string;provider?:string},transactionId?:number){
  const data=providerRefund.parse(raw);
  if(data.amount!==expected.amount||(expected.provider&&String(data.id)!==expected.provider)||(typeof data.transaction==='number'?data.transaction!==transactionId:data.transaction.reference!==expected.reference))throw new Error('Refund verification mismatch');
  return {id:String(data.id),amount:data.amount,status:data.status==='processed'?'processed':data.status==='failed'?'failed':'processing'};
}
export async function submitRefund(id:string,reference:string,amount:number){
  const data=await paystack('/refund',{transaction:reference,amount,currency:'NGN',merchant_note:`Edgedirect2u refund ${id}`});
  return validateRefund(data,{amount,reference});
}
export async function fetchRefund(provider:string,reference:string,amount:number){
  const [data,transaction]=await Promise.all([paystack(`/refund/${encodeURIComponent(provider)}`),paystack(`/transaction/verify/${encodeURIComponent(reference)}`)]);
  if(transaction.reference!==reference)throw new Error('Refund verification mismatch');
  return validateRefund(data,{amount,reference,provider},transaction.id);
}
