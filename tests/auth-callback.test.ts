import { afterEach, beforeEach, it, expect, vi } from 'vitest';
const auth = vi.hoisted(() => ({
  resetPasswordForEmail:vi.fn(), getUser:vi.fn(), setSession:vi.fn(),
  exchangeCodeForSession:vi.fn(), verifyOtp:vi.fn(), updateUser:vi.fn(),
}));
vi.mock('../src/lib/server', () => ({ configured:()=>true, supabase:async()=>({auth}) }));
import { POST } from '../src/app/api/auth/route';
import { GET, POST as confirmEmail } from '../src/app/auth/confirm/route';
beforeEach(()=>vi.resetAllMocks());
afterEach(()=>vi.unstubAllEnvs());
const origin='https://edgedirect2u.vercel.app';
const request=(body:unknown)=>new Request(`${origin}/api/auth`,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});

it('sends recovery back to the origin where the request and PKCE cookies were created',async()=>{
  auth.resetPasswordForEmail.mockResolvedValue({error:null});
  const response=await POST(request({action:'recover',email:'qa@example.com'}));
  expect(response.status).toBe(200);
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('qa@example.com',{redirectTo:`${origin}/auth/confirm?next=/reset-password`});
});
it('recognizes recovery PKCE callbacks even when Supabase falls back to the homepage',async()=>{
  auth.exchangeCodeForSession.mockResolvedValue({data:{redirectType:'recovery'},error:null});
  const response=await GET(new Request(`${origin}/auth/confirm?code=qa-code`));
  expect(response.headers.get('location')).toBe(`${origin}/reset-password?verified=1`);
});
it('keeps checkout confirmation returns local and rejects arbitrary next destinations',async()=>{
  auth.exchangeCodeForSession.mockResolvedValue({data:{redirectType:null},error:null});
  expect((await GET(new Request(`${origin}/auth/confirm?code=qa-code&next=/checkout`))).headers.get('location')).toBe(`${origin}/auth/verified?next=/checkout`);
  expect((await GET(new Request(`${origin}/auth/confirm?code=qa-code&next=https://untrusted.example`))).headers.get('location')).toBe(`${origin}/auth/verified`);
});
it('does not consume email tokens when scanners follow GET links',async()=>{
  const token='qa-single-use-email-token-hash';
  const response=await GET(new Request(`${origin}/auth/confirm?token_hash=${token}&type=recovery`));
  const landing=new URL(response.headers.get('location')!);
  expect(landing.pathname).toBe('/auth/verify');expect(landing.searchParams.get('token_hash')).toBe(token);
  expect(auth.verifyOtp).not.toHaveBeenCalled();
});
it('uses the configured public origin behind Hostinger for successful and expired callbacks',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://edgedirect2u.com');
  auth.exchangeCodeForSession.mockResolvedValue({data:{redirectType:'recovery'},error:null});
  const internal='http://0.0.0.0:3000/auth/confirm?code=qa-code';
  expect((await GET(new Request(internal,{headers:{'x-forwarded-host':'untrusted.example'}}))).headers.get('location')).toBe('https://edgedirect2u.com/reset-password?verified=1');
  auth.exchangeCodeForSession.mockResolvedValue({data:{},error:new Error('Expired')});
  expect((await GET(new Request(internal))).headers.get('location')).toBe('https://edgedirect2u.com/forgot-password?expired=1');
});
it('verifies recovery only on an explicit same-origin form submission and uses a public 303 redirect',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://edgedirect2u.com');
  auth.verifyOtp.mockResolvedValue({error:null});
  const body=new URLSearchParams({token_hash:'qa-single-use-email-token-hash',type:'recovery',next:'/account'});
  const response=await confirmEmail(new Request('http://0.0.0.0:3000/auth/confirm',{method:'POST',headers:{origin:'https://edgedirect2u.com','Content-Type':'application/x-www-form-urlencoded'},body}));
  expect(auth.verifyOtp).toHaveBeenCalledWith({token_hash:'qa-single-use-email-token-hash',type:'recovery'});
  expect(response.status).toBe(303);expect(response.headers.get('location')).toBe('https://edgedirect2u.com/reset-password?verified=1');
});
it('rejects cross-origin token submissions before verification and preserves only safe checkout returns',async()=>{
  auth.verifyOtp.mockResolvedValue({error:null});
  const submit=(requestOrigin:string,next:string)=>confirmEmail(new Request(`${origin}/auth/confirm`,{method:'POST',headers:{origin:requestOrigin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token_hash:'qa-single-use-email-token-hash',type:'signup',next})}));
  expect((await submit('https://untrusted.example','/checkout')).headers.get('location')).toBe(`${origin}/forgot-password?expired=1`);
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect((await submit(origin,'/checkout')).headers.get('location')).toBe(`${origin}/auth/verified?next=/checkout`);
  expect((await submit(origin,'https://untrusted.example')).headers.get('location')).toBe(`${origin}/auth/verified`);
});
it('verifies implicit recovery identity before setting session cookies',async()=>{
  const access='qa-access-token-value',refresh='qa-refresh-token-value';
  auth.getUser.mockResolvedValue({data:{user:{id:'qa-user',is_anonymous:false}},error:null});
  auth.setSession.mockResolvedValue({data:{user:{id:'qa-user'}},error:null});
  const response=await POST(request({action:'recovery-session',access_token:access,refresh_token:refresh}));
  expect(response.status).toBe(200);expect(auth.getUser).toHaveBeenCalledWith(access);
  expect(auth.setSession).toHaveBeenCalledWith({access_token:access,refresh_token:refresh});
  expect(await response.text()).not.toContain(access);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('does not install invalid or anonymous recovery sessions',async()=>{
  for(const user of [null,{id:'anonymous',is_anonymous:true}]){
    auth.getUser.mockResolvedValue({data:{user},error:null});
    expect((await POST(request({action:'recovery-session',access_token:'qa-access-token-value',refresh_token:'qa-refresh-token-value'}))).status).toBe(400);
  }
  expect(auth.setSession).not.toHaveBeenCalled();
});
it('explains when the chosen password is already current without falsely claiming a change',async()=>{
  auth.getUser.mockResolvedValue({data:{user:{id:'qa-user',is_anonymous:false}}});
  auth.updateUser.mockResolvedValue({error:{code:'same_password',message:'New password should be different from the old password.'}});
  const response=await POST(request({action:'update-password',password:'qa-current-password'}));
  expect(response.status).toBe(200);const data=await response.json();expect(data.unchanged).toBe(true);expect(data.message).toContain('already set');expect(data.message).not.toContain('has been updated');
});
it('keeps other password failures visible and requires a verified account',async()=>{
  auth.getUser.mockResolvedValue({data:{user:{id:'qa-user',is_anonymous:false}}});
  auth.updateUser.mockResolvedValue({error:{code:'weak_password',message:'Please choose a stronger password'}});
  expect((await POST(request({action:'update-password',password:'qa-new-password'}))).status).toBe(400);
  auth.getUser.mockResolvedValue({data:{user:null}});
  expect((await POST(request({action:'update-password',password:'qa-new-password'}))).status).toBe(401);
});
