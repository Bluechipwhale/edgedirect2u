import {it,expect} from 'vitest';
import {createServerClient} from '@supabase/ssr';
it('removes every session cookie chunk and cannot restore the signed-out account',async()=>{
 const jar=new Map<string,string>(),cleared:string[]=[],requests:string[]=[];
 const user={id:'80000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{},user_metadata:{fixture:'x'.repeat(5000)},created_at:new Date().toISOString()};
 const client=()=>createServerClient('https://logout-fixture.supabase.co','fixture-anon-key',{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:changes=>{for(const c of changes){if(c.options.maxAge===0){cleared.push(c.name);jar.delete(c.name);}else jar.set(c.name,c.value);}}},global:{fetch:async(input)=>{const url=String(input);requests.push(url);return new Response(JSON.stringify(url.includes('/logout')?{}:user),{status:200,headers:{'Content-Type':'application/json'}});}}});
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',fixture:'x'.repeat(6000),exp:Math.floor(Date.now()/1000)+3600},'fixture-signature'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 const db=client();expect((await db.auth.setSession({access_token:jwt,refresh_token:'fixture-refresh-token'})).error).toBeNull();const names=[...jar.keys()].filter(k=>k.includes('auth-token'));expect(names.length).toBeGreaterThan(1);
 expect((await db.auth.signOut({scope:'local'})).error).toBeNull();expect(requests.some(u=>u.includes('/logout?scope=local'))).toBe(true);expect(names.every(n=>cleared.includes(n))).toBe(true);expect([...jar.keys()].some(k=>k.includes('auth-token'))).toBe(false);expect((await client().auth.getSession()).data.session).toBeNull();
});
