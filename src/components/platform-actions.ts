'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function usePlatformAction(){const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const router=useRouter();async function submit(data:unknown){setBusy(true);setMessage('');try{const r=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Unable to save');setMessage('Saved successfully.');router.refresh();return true;}catch(e){setMessage(e instanceof Error?e.message:'Unable to save');return false;}finally{setBusy(false);}}return {busy,message,submit};}
