'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
function subscribeOnline(callback:()=>void){window.addEventListener('online',callback);window.addEventListener('offline',callback);return()=>{window.removeEventListener('online',callback);window.removeEventListener('offline',callback);};}
function subscribeDisplay(callback:()=>void){const query=window.matchMedia('(display-mode: standalone)');query.addEventListener('change',callback);return()=>query.removeEventListener('change',callback);}
export function AppLifecycle(){
  const online=useSyncExternalStore(subscribeOnline,()=>navigator.onLine,()=>true);
  useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('/app-sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});},[]);
  return online?null:<div className="connection-banner" role="status">You’re offline. Reconnect before sending an order or delivery update.</div>;
}
export function AppInstall({driver=false}:{driver?:boolean}){
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[message,setMessage]=useState('');
  const installed=useSyncExternalStore(subscribeDisplay,()=>window.matchMedia('(display-mode: standalone)').matches,()=>false);
  useEffect(()=>{const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};const done=()=>{setPrompt(null);setMessage('Installed. Find your app on your home screen.');};window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);};},[]);
  return <div className="install-control">{installed?<p className="help-text">You’re using the installed app. Your online workspace stays up to date.</p>:<><button className="button" onClick={async()=>{if(!prompt){setMessage('Open your browser menu and choose Install app or Add to Home Screen. On iPhone, open Share in Safari, then Add to Home Screen.');return;}try{await prompt.prompt();const choice=await prompt.userChoice;setPrompt(null);setMessage(choice.outcome==='accepted'?'Your app is being installed.':'You can install it whenever you are ready.');}catch{setMessage('Use your browser menu to install the app.');}}}>Install {driver?'driver':'store'} web app <span>↗</span></button><p className="help-text">Works from your browser. A connection is required for live shopping and delivery updates.</p></>}{message&&<p className="info-message" role="status">{message}</p>}</div>;
}
