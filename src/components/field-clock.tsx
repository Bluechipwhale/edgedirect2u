'use client';
import {useEffect,useRef,useState} from 'react';
import {MapPin,LocateFixed} from 'lucide-react';
import type {CompanySnapshot,FieldStore} from '@/lib/platform-contract';
import {metresBetween,readFieldLocation,storeRadius} from '@/lib/field-location';
import {usePlatformAction} from './platform-actions';
export function FieldClock({snapshot:s,onStarted}:{snapshot:CompanySnapshot;onStarted:()=>void}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stores=s.assignments.filter(a=>a.agent_id===s.actorId&&a.visit_date===today&&!s.visits.some(v=>v.assignment_id===a.id&&v.completed_at)).map(a=>s.stores.find(store=>store.id===a.store_id)).filter((store):store is FieldStore=>!!store).sort((a,b)=>Number(!!a.is_test)-Number(!!b.is_test)||(a.route_sequence??9999)-(b.route_sequence??9999)||a.name.localeCompare(b.name));
 const [selected,setSelected]=useState(''),[reading,setReading]=useState(false),[notice,setNotice]=useState('');const controller=useRef<AbortController|null>(null);
 const {submit,busy,message}=usePlatformAction();useEffect(()=>()=>controller.current?.abort(),[]);
 if(s.role!=='field_agent')return null;
 const shift=s.shifts.find(v=>v.agent_id===s.actorId&&!v.ended_at),open=s.visits.find(v=>v.agent_id===s.actorId&&!v.completed_at),store=stores.find(v=>v.id===selected)||stores[0];
 const enabled=s.modules.some(m=>m.module==='field_operations'&&m.enabled)&&s.company.allow_web_checkin;
 async function clock(){
  if(!store)return;setNotice('');if(store.latitude===null||store.longitude===null){setNotice('This store needs a supervisor-approved GPS location before clock-in.');return;}
  if(!navigator.geolocation){setNotice('Location is unavailable on this device. Use the updated driver app with precise location enabled.');return;}
  controller.current?.abort();const current=new AbortController();controller.current=current;setReading(true);setNotice('Getting a fresh GPS reading…');
  try{const radius=storeRadius(s.company,store),point=await readFieldLocation(navigator.geolocation,{signal:current.signal,target:{latitude:store.latitude,longitude:store.longitude,radius},onProgress:accuracy=>setNotice(`Checking GPS accuracy: ±${Math.ceil(accuracy)}m…`)});
   const distance=metresBetween(point,{latitude:store.latitude,longitude:store.longitude});if(distance+point.accuracy>radius){setNotice(`You are ${Math.round(distance)}m from this store (GPS accuracy ±${Math.ceil(point.accuracy)}m). Move inside the ${radius}m boundary and retry.`);return;}
   setNotice('Verifying your location with the server…');if(await submit({action:'start-store',company_id:s.company.id,store:store.id,...point})){setNotice(store.is_test?'Test clock-in verified. This visit is excluded from sales and outlet performance totals.':'Clock-in verified. Your shift and store visit are now open.');onStarted();}else setNotice('Clock-in was not accepted. See the message below and retry at the assigned store.');
  }catch(error){if(!current.signal.aborted)setNotice(error instanceof Error?error.message:'Unable to verify GPS.');}finally{if(!current.signal.aborted)setReading(false);}
 }
 return <section className="platform-panel field-clock"><div className="directory-heading"><div><span className="eyebrow">GPS CLOCK-IN</span><h2><LocateFixed size={23}/>{shift?(shift.test_only?'Test clock-in active':'Your shift is open'):'Start your field day at a store'}</h2><p>Clock-in starts only at an assigned outlet. Your phone’s GPS uncertainty must fit inside the {s.company.id==='10000000-0000-4000-8000-000000000001'?50:s.company.geofence_metres}m boundary.</p></div>{shift&&<button className="small-button" disabled={busy||reading||!!open} onClick={()=>void submit({action:'shift',company_id:s.company.id,operation:'out'})}>Clock out</button>}</div>
 {open?<><p className="info-message">A store visit is already open. Complete its report before starting another visit or clocking out.</p><button className="button" onClick={onStarted}>Continue open visit →</button></>:!stores.length?<p>No visits remain assigned for today. Ask your manager to assign your route.</p>:<><label>Assigned store<select aria-label="Clock-in store" value={store?.id||''} disabled={busy||reading} onChange={e=>{setSelected(e.target.value);setNotice('');}}>{stores.map(p=><option value={p.id} key={p.id}>{p.is_test?'TEST · ':p.route_sequence?`Stop ${p.route_sequence} · `:''}{p.name}</option>)}</select></label>{store?.is_test&&<p className="info-message">Test store only. This does not count as a production customer visit.</p>}<button className="button" disabled={!enabled||busy||reading||!store} onClick={()=>void clock()}><MapPin size={17}/>{reading?'Verifying GPS…':'Use my location & clock in'}</button></>}
 {!enabled&&<p className="info-message">Store execution is disabled by company policy. Contact your manager.</p>}{notice&&<p className="info-message" role="status">{notice}</p>}{message&&<p className="info-message" role="status">{message}</p>}
 </section>;
}
