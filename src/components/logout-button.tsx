'use client';
import {useRef,useState} from 'react';
import {LogOut} from 'lucide-react';
import {requestJson} from '@/lib/client-request';
export const logoutEventKey='edge-auth-signed-out';
export function LogoutButton(){const pending=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');return <span className="logout-control"><button type="button" className="small-button logout-button" disabled={busy} onClick={async()=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await requestJson('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});try{sessionStorage.removeItem('edge-checkout-intent');localStorage.setItem(logoutEventKey,String(Date.now()));}catch{/* Storage can be disabled; server sign-out still succeeds. */}window.location.replace('/login?logged_out=1');}catch(e){setError(e instanceof Error?e.message:'Unable to log out. Please try again.');pending.current=false;setBusy(false);}}}><LogOut size={16} aria-hidden="true"/>{busy?'Logging out…':'Log out'}</button>{error&&<span className="logout-error" role="alert">{error}</span>}</span>;}
