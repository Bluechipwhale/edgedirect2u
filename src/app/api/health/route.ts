import { NextResponse } from 'next/server';
import { configured } from '@/lib/server';
import { createClient } from '@supabase/supabase-js';
export async function GET() {
  let ready=false;
  if(configured()){
    try{
      const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error}=await db.from('website_settings').select('id').eq('id','published').abortSignal(AbortSignal.timeout(5000)).single();
      ready=!error&&data?.id==='published';
    }catch{}
  }
  return NextResponse.json({status:ready?'ok':'unavailable'},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
}
