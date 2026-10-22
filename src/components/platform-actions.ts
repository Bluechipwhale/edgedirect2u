'use client';
import { useRef,useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {requestJson} from '@/lib/client-request';
export function usePlatformAction(){const [saving,setBusy]=useState(false),[message,setMessage]=useState('');const [refreshing,startTransition]=useTransition();const busy=saving||refreshing;const pending=useRef(false);const router=useRouter();async function submit(data:unknown){if(pending.current||refreshing)return false;pending.current=true;setBusy(true);setMessage('');try{await requestJson('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});setMessage('Saved successfully.');startTransition(()=>router.refresh());return true;}catch(e){setMessage(e instanceof Error?e.message:'Unable to save');return false;}finally{pending.current=false;setBusy(false);}}return {busy,message,submit};}
