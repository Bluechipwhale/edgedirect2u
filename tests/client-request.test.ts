import {afterEach,expect,it,vi} from 'vitest';
import {requestJson} from '../src/lib/client-request';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('returns successful saves and preserves server validation messages',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({ok:true,id:'saved'})).mockResolvedValueOnce(Response.json({error:'Restore product before editing'},{status:400}));vi.stubGlobal('fetch',fetcher);
 expect(await requestJson('/api/manage',{method:'POST'})).toEqual({ok:true,id:'saved'});
 await expect(requestJson('/api/manage',{method:'POST'})).rejects.toThrow('Restore product before editing');
});
it('bounds a stalled mutation without automatically submitting it again',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));}));vi.stubGlobal('fetch',fetcher);
 const result=requestJson('/api/platform',{method:'POST'},1000),rejection=expect(result).rejects.toThrow('Refresh to check whether your change was saved');await vi.advanceTimersByTimeAsync(1000);await rejection;expect(fetcher).toHaveBeenCalledTimes(1);
});
it('handles expired sign-in, lost connections and invalid proxy responses clearly',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({error:'Authentication required'},{status:401})).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('<html>Gateway timeout</html>',{status:504})));
 await expect(requestJson('/api/manage',{method:'POST'})).rejects.toThrow('Sign in again');
 await expect(requestJson('/api/manage',{method:'POST'})).rejects.toThrow('Reconnect and refresh');
 await expect(requestJson('/api/manage',{method:'POST'})).rejects.toThrow('server response could not be read');
});
