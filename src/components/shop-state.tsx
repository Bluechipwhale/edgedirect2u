'use client';
import { createContext, useContext, useSyncExternalStore, useState, useRef, useEffect, type ReactNode } from 'react';
import type { Product } from '@/lib/types';
import { cartKey, restoreShopping, type ShoppingState as State } from '@/lib/shopping-storage';
export type { CartLine } from '@/lib/shopping-storage';
const empty: State = { cart: [], wishlist: [] }; let snapshot = empty; let loaded = false; const listeners = new Set<() => void>();
function getState() { if(!loaded && typeof window !== 'undefined') { loaded=true; try { snapshot=restoreShopping(localStorage.getItem('edge-shopping')); }catch{} }return snapshot; }
function update(value: State) { snapshot=value; try{localStorage.setItem('edge-shopping',JSON.stringify(value));}catch{} listeners.forEach(fn=>fn()); }
function storageChanged(event:StorageEvent){if(event.key==='edge-shopping'||event.key===null){snapshot=restoreShopping(event.newValue);listeners.forEach(fn=>fn());}}
const subscribe=(fn:()=>void)=>{if(!listeners.size)window.addEventListener('storage',storageChanged);listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size)window.removeEventListener('storage',storageChanged);};};
const Context=createContext<{state:State;add:(p:Product,q?:number,o?:Record<string,string>)=>void;quantity:(key:string,q:number)=>void;wish:(id:string)=>void;clear:()=>void;notify:(s:string)=>void} | null>(null);
export function ShopProvider({children}:{children:ReactNode}) {
  const state=useSyncExternalStore(subscribe,getState,()=>empty); const [toast,setToast]=useState('');
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const notify=(text:string)=>{if(timer.current)clearTimeout(timer.current);setToast(text);timer.current=setTimeout(()=>setToast(''),3500);};
  function add(product:Product,quantity=1,options:Record<string,string>={}) { if(!Number.isInteger(quantity)||quantity<1||product.stock-product.reserved<quantity){notify('This item is currently unavailable');return;} const key=cartKey(product.id,options); const current=getState(); const exists=current.cart.find(c=>c.key===key); if(!exists&&current.cart.length>=50){notify('Your bag holds up to 50 different finds.');return;} update({...current,cart:exists?current.cart.map(c=>c.key===key?{...c,product,quantity:Math.min(50,c.quantity+quantity,product.stock-product.reserved)}:c):[...current.cart,{key,product,quantity:Math.min(quantity,50),options}]});notify('Added to your bag'); }
  return <Context.Provider value={{state,add,quantity:(key,q)=>update({...getState(),cart:getState().cart.map(c=>c.key===key?{...c,quantity:Math.max(0,Math.min(50,Number.isFinite(q)?Math.floor(q):0,c.product.stock-c.product.reserved))}:c).filter(c=>c.quantity>0)}),wish:id=>{const s=getState();if(!s.wishlist.includes(id)&&s.wishlist.length>=100){notify('Your wishlist holds up to 100 finds. Remove one to save another.');return;}update({...s,wishlist:s.wishlist.includes(id)?s.wishlist.filter(i=>i!==id):[...s.wishlist,id]});},clear:()=>update({...getState(),cart:[]}),notify}}>{children}{toast&&<div className="toast" role="status">{toast}</div>}</Context.Provider>;
}
export function useShop(){const value=useContext(Context);if(!value)throw new Error('ShopProvider missing');return value;}
