'use client';
import {useEffect} from 'react';
import {isChunkFailure,shouldRecoverChunk} from '@/lib/chunk-recovery';
export default function Page({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const updated=isChunkFailure(error.message||'');
 useEffect(()=>{try{const key='edge-page-recovery',now=Date.now(),last=Number(sessionStorage.getItem(key)||0);if(shouldRecoverChunk(error.message||'',last,now)){sessionStorage.setItem(key,String(now));window.location.reload();}}catch{/* A manual reload remains available if browser storage is blocked. */}},[error]);
 return <div className="container narrow-page"><h1>{updated?'Refreshing your workspace.':'A little pause.'}</h1><p>{updated?'A newer version is available. Reload this page to continue.':'We couldn’t load this page. Please try again.'}</p><p>If you were saving a change, check the record before submitting it again.</p><button className="button" onClick={()=>updated?window.location.reload():reset()}>{updated?'Reload latest version':'Try again'}</button></div>;
}
