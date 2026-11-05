'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {LogoutButton} from './logout-button';
export function AccountSettings({name,local}:{name:string;local:boolean}){const [value,setValue]=useState(name),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();
async function send(){setBusy(true);setMessage('');try{const res=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:value})});const data=await res.json();if(!res.ok)throw new Error(data.error);setMessage('Profile saved.');router.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}}
return <><form className="auth-form" onSubmit={e=>{e.preventDefault();send();}}><label>Display name<input required minLength={2} maxLength={100} value={value} onChange={e=>setValue(e.target.value)}/></label><button className="button" disabled={busy}>Save profile</button></form>{!local&&<LogoutButton/>}{message&&<p role="status">{message}</p>}</>;}
