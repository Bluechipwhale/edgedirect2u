import { NextResponse } from 'next/server';
import { supabase } from '@/lib/server';
import { businessAction } from '@/lib/business';
import { guard, failure } from '@/lib/http';
export async function POST(req:Request){
  try{
    guard(req);
    const text=await req.text();if(text.length>12000)throw new Error('Request too large');
    const input=businessAction.parse(JSON.parse(text));
    const db=await supabase();const {data:{user}}=await db.auth.getUser();
    if(!user||user.is_anonymous)throw new Error('Authentication required');
    let result;
    switch(input.action){
      case 'access':result=await db.rpc('business_set_access',{p_email:input.email,p_role:input.role,p_principal:input.principal,p_active:input.active});break;
      case 'stock':result=await db.rpc('business_adjust_stock',{p_id:input.id,p_product:input.product,p_delta:input.quantity,p_reason:input.reason});break;
      case 'transfer':result=await db.rpc('business_allocate_van',{p_id:input.id,p_seller:input.seller,p_product:input.product,p_quantity:input.quantity,p_reason:input.reason});break;
      case 'sale':result=await db.rpc('business_record_sale',{p_id:input.id,p_product:input.product,p_quantity:input.quantity,p_note:input.note});break;
      case 'cash':result=await db.rpc('business_confirm_cash',{p_sale:input.sale});break;
      case 'map':result=await db.rpc('business_map_product',{p_product:input.product,p_principal:input.principal});break;
    }
    if(result.error)throw new Error(result.error.message);
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return failure(e);}
}
