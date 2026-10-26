require('@next/env').loadEnvConfig(process.cwd());
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {createServer}=require('node:net');
async function availablePort(){
  const probe=createServer();
  await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port=probe.address().port;
  await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
  return port;
}
async function main(){
  const port=await availablePort();
  const origin=`http://127.0.0.1:${port}`;
  const entry=process.argv.includes('--root-entry')?'server.js':'.next/standalone/server.js';
  const child=spawn(process.execPath,['--use-system-ca',entry],{env:{...process.env,NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let logs='';child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);
  try{
    let ready=false;
    for(let i=0;i<30;i++){
      if(child.exitCode!==null)throw new Error('Standalone server exited before verification');
      try{const response=await fetch(origin+'/fonts/geist.woff2',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!ready)throw new Error('Standalone server did not start');
    const theme=await fetch(origin+'/api/theme',{signal:AbortSignal.timeout(15000)});
    if(theme.status!==401 || !theme.headers.get('cache-control')?.includes('no-store'))throw new Error('Private theme API access check failed');
    const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(15000)});
    if(!health.ok)throw new Error('Live database health check failed');
    const home=await fetch(origin,{signal:AbortSignal.timeout(20000)});
    const html=await home.text();
    if(!home.ok || !html.includes('Your everyday.') || !home.headers.get('content-security-policy')?.includes("'strict-dynamic'"))throw new Error('Production storefront or CSP check failed');
    if(home.headers.has('x-powered-by'))throw new Error('Framework header should be disabled');
    if(!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY){
      const checkout=await fetch(origin+'/api/checkout',{method:'POST',headers:{Origin:new URL(process.env.NEXT_PUBLIC_SITE_URL).origin,'Content-Type':'application/json'},body:JSON.stringify({key:require('node:crypto').randomUUID(),items:[{product_id:'unavailable-production-smoke-test',quantity:1,options:{}}],address:{name:'Smoke Test',email:'test@example.com',phone:'08012345678',street:'123 Test Street',city:'Lagos',state:'Lagos'},coupon:''}),signal:AbortSignal.timeout(15000)});
      if(checkout.status!==401)throw new Error('Unauthenticated checkout was not blocked before reservation');
    }
    const image=await fetch(origin+'/opengraph-image',{signal:AbortSignal.timeout(15000)});
    if(!image.ok || !image.headers.get('content-type')?.includes('image/png'))throw new Error('Social share image did not render');
    console.log('PASS Standalone server, live Supabase health, storefront, local font, private API access, CSP, checkout guard and social share image.');
  }finally{
    if(child.exitCode===null){child.kill();await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,3000))]);}
  }
  // Keep logs private by default; provider output may contain environment details.
  if(logs.includes('EADDRINUSE'))throw new Error('Production smoke-test port is occupied');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
