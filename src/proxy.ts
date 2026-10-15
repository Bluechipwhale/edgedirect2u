import { createServerClient } from '@supabase/ssr';
import { NextResponse,type NextRequest } from 'next/server';
export async function proxy(request:NextRequest){
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
  const dev=process.env.NODE_ENV!=='production';
  const csp=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' https: data: blob:","font-src 'self'","object-src 'none'","base-uri 'self'","form-action 'self'","frame-src 'self'","frame-ancestors 'self'",`connect-src 'self'${dev?' ws: wss:':''}`,"worker-src 'self'",...(request.nextUrl.protocol==='https:'&&!dev?['upgrade-insecure-requests']:[])].join('; ');
  const requestHeaders=new Headers(request.headers);
  requestHeaders.set('x-nonce',nonce);requestHeaders.set('Content-Security-Policy',csp);
  let response=NextResponse.next({request:{headers:requestHeaders}});
  if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY){
    const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>request.cookies.getAll(),setAll:items=>{
      items.forEach(c=>request.cookies.set(c.name,c.value));
      requestHeaders.set('cookie',request.cookies.toString());
      response=NextResponse.next({request:{headers:requestHeaders}});
      items.forEach(c=>response.cookies.set(c.name,c.value,c.options));
    }}});
    await db.auth.getUser();
  }
  response.headers.set('Content-Security-Policy',csp);
  if(request.nextUrl.pathname==='/app-sw.js'){response.headers.set('Cache-Control','no-cache, no-store, must-revalidate');response.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'");}
  if(/^\/(admin|account|merchant|driver|company|field|platform|checkout|forgot-password|reset-password|auth|theme-preview|api)(\/|$)/.test(request.nextUrl.pathname))response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|fonts|icon.svg).*)']};
