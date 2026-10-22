/** Mutations are never retried automatically: a lost response may already be saved. */
export async function requestJson<T = {ok?:boolean;id?:string;url?:string}>(url:string,init:RequestInit,timeoutMs=20000):Promise<T>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...init,signal:controller.signal});
  let result:unknown;
  try{result=await response.json();}catch(error){
   if(controller.signal.aborted)throw error;
   throw new Error('The server response could not be read. Refresh to check whether your change was saved before trying again.');
  }
  if(!response.ok){
   if(response.status===401)throw new Error('Your session has expired. Sign in again before continuing.');
   const message=result&&typeof result==='object'&&'error' in result&&typeof result.error==='string'?result.error:'The change could not be saved.';
   throw new Error(message);
  }
  return result as T;
 }catch(error){
  if(controller.signal.aborted)throw new Error('The request timed out. Refresh to check whether your change was saved before trying again.');
  if(error instanceof TypeError)throw new Error('Connection lost. Reconnect and refresh to check whether your change was saved before trying again.');
  throw error;
 }finally{clearTimeout(timer);}
}
