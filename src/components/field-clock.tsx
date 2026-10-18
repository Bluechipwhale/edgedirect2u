'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronDown,Compass,LocateFixed,MapPin,Navigation,ShieldCheck,Signal,SquareArrowOutUpRight} from 'lucide-react';
import type {CompanySnapshot,FieldStore} from '@/lib/platform-contract';
import {metresBetween,readFieldLocation,storeRadius,type FieldLocation} from '@/lib/field-location';
import {usePlatformAction} from './platform-actions';

export function FieldClock({snapshot:s,onStarted,fieldMode=true}:{snapshot:CompanySnapshot;onStarted:()=>void;fieldMode?:boolean}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stores=s.assignments.filter(a=>a.agent_id===s.actorId&&a.visit_date===today&&!s.visits.some(v=>v.assignment_id===a.id&&v.completed_at)).map(a=>s.stores.find(store=>store.id===a.store_id)).filter((store):store is FieldStore=>!!store).sort((a,b)=>Number(!!a.is_test)-Number(!!b.is_test)||(a.route_sequence??9999)-(b.route_sequence??9999)||a.name.localeCompare(b.name));
 const [selected,setSelected]=useState(''),[reading,setReading]=useState(false),[notice,setNotice]=useState(''),[fix,setFix]=useState<(FieldLocation&{distance:number})|null>(null);
 const [atEntrance,setAtEntrance]=useState(false),[reviewSent,setReviewSent]=useState(false);
 const controller=useRef<AbortController|null>(null),{submit,busy,message}=usePlatformAction();
 useEffect(()=>()=>controller.current?.abort(),[]);
 if(s.role!=='field_agent')return null;
 // A document navigation loads the field route's Permissions-Policy before GPS is requested.
 if(!fieldMode)return <section className="platform-panel field-clock field-clock-link"><span className="eyebrow">YOUR FIELD WORKSPACE</span><h2>Ready for your next stop?</h2><p>Open the field workspace to use GPS, clock in and complete store visits.</p><a className="button" href={`/field/${s.company.slug}`}>Open GPS field workspace <ArrowUpRight size={17}/></a></section>;
 const shift=s.shifts.find(v=>v.agent_id===s.actorId&&!v.ended_at),open=s.visits.find(v=>v.agent_id===s.actorId&&!v.completed_at),store=stores.find(v=>v.id===selected),openStore=s.stores.find(v=>v.id===s.assignments.find(a=>a.id===open?.assignment_id)?.store_id);
 const enabled=s.modules.some(m=>m.module==='field_operations'&&m.enabled)&&s.company.allow_web_checkin;
 const radius=storeRadius(s.company,store||{radius_metres:null}),inside=!!fix&&fix.distance+fix.accuracy<=radius;
 function choose(id:string){controller.current?.abort();setReading(false);setSelected(id);setFix(null);setNotice('');setAtEntrance(false);setReviewSent(false);}
 async function requestReview(){
  if(!store||!fix||!atEntrance||busy||reading)return;
  controller.current?.abort();const current=new AbortController();controller.current=current;setReading(true);
  try{const point=await readFieldLocation(navigator.geolocation,{signal:current.signal});if(current.signal.aborted)return;
   if(await submit({action:'location-proposal',company_id:s.company.id,store:store.id,latitude:point.latitude,longitude:point.longitude,accuracy:point.accuracy,captured:point.captured})){setReviewSent(true);setNotice('Location sent to your manager for review. This does not clock you in or change the saved outlet position. Your manager must verify and approve it first.');}
  }catch(error){if(!current.signal.aborted)setNotice(error instanceof Error?error.message:'Could not send the location for review.');}finally{if(!current.signal.aborted)setReading(false);}
 }
 async function clock(){
  if(!store||busy||reading)return;setNotice('');setFix(null);
  if(store.latitude===null||store.longitude===null){setNotice('This outlet has no approved GPS position. Ask your manager to verify it before clock-in.');return;}
  if(!navigator.geolocation){setNotice('Location is unavailable. Open this HTTPS field page in your phone browser and turn on location.');return;}
  controller.current?.abort();const current=new AbortController();controller.current=current;setReading(true);setNotice('Finding your location. Stay at the outlet entrance while GPS settles…');
  try{
   const point=await readFieldLocation(navigator.geolocation,{signal:current.signal,target:{latitude:store.latitude,longitude:store.longitude,radius},onProgress:accuracy=>setNotice(`Getting a precise fix · current accuracy ±${Math.ceil(accuracy)}m. Stay here for a moment…`)});
   if(current.signal.aborted)return;
   const distance=metresBetween(point,{latitude:store.latitude,longitude:store.longitude});setFix({...point,distance});
   if(distance+point.accuracy>radius){setNotice(`Your phone reports ${Math.round(distance)}m from ${store.name}. Clock-in needs your distance plus GPS uncertainty to fit inside ${radius}m. Move closer and retry. Already at the outlet? Check precise location, then ask your manager to verify the saved outlet position.`);return;}
   setNotice('You’re in range. Securing your clock-in…');
   if(await submit({action:'start-store',company_id:s.company.id,store:store.id,...point})){setNotice('Clock-in confirmed. Your visit is open.');onStarted();}
   else setNotice('The server could not accept this visit. Read the message below before retrying.');
  }catch(error){if(!current.signal.aborted)setNotice(error instanceof Error?error.message:'Location could not be verified. Open Location help and retry.');}
  finally{if(!current.signal.aborted)setReading(false);}
 }
 const groups=[{title:'Today’s customer outlets',test:false},{title:'Test outlet · excluded from performance',test:true}];
 return <section className="platform-panel field-clock" aria-label="GPS clock-in">
  <div className="clock-topline"><span className="clock-kicker"><span className={shift?'clock-dot is-live':'clock-dot'}/>{shift?'SHIFT ACTIVE':'LET’S GET MOVING'}</span><span className="clock-radius"><ShieldCheck size={14}/>{radius}m verified zone</span></div>
  <div className="clock-layout"><div className="clock-content">
   <h2>{open?'You’re checked in.':shift?'Make your next stop.':'Your next stop starts here.'}</h2>
   <p className="clock-intro">{open?openStore?.name||'Your outlet visit is open.':'Choose the outlet you’re visiting. We’ll check your live GPS and open your visit in one tap.'}</p>
   {open?<div className="clock-open"><span className="clock-confirm"><Check size={17}/>Clock-in confirmed</span><p>{openStore?.is_test?'This is a GPS test, separate from your customer performance.':'Complete your visit report before moving to the next outlet.'}</p>{openStore?.is_test?<button className="button clock-primary" disabled={busy} onClick={()=>void submit({action:'finish-test',company_id:s.company.id,visit:open.id})}>Finish test &amp; clock out <Check size={17}/></button>:<button className="button clock-primary" onClick={onStarted}>Continue visit <ArrowUpRight size={18}/></button>}</div>
   :!stores.length?<div className="clock-empty"><Check size={22}/><h3>No visits waiting.</h3><p>Your assigned visits are complete, or your manager needs to add today’s route.</p></div>
   :<><label className="clock-select-label">01 / CHOOSE YOUR OUTLET<div className="clock-select-wrap"><MapPin size={18}/><select aria-label="Clock-in store" value={store?.id||''} disabled={busy||reading} onChange={e=>choose(e.target.value)}><option value="">Select the outlet you are visiting</option>{groups.map(group=>stores.some(p=>!!p.is_test===group.test)&&<optgroup key={group.title} label={group.title}>{stores.filter(p=>!!p.is_test===group.test).map(p=><option value={p.id} key={p.id}>{p.is_test?'TEST · ':p.route_sequence?`Stop ${p.route_sequence} · `:''}{p.name}</option>)}</optgroup>)}</select><ChevronDown size={16}/></div></label>
    {store&&<div className="clock-store"><span className="clock-store-icon"><MapPin size={20}/></span><div><strong>{store.name}</strong><p>{store.address}</p>{store.is_test&&<span className="clock-test-label">Test only · does not count as a customer visit</span>}</div>{store.latitude!==null&&store.longitude!==null&&<a aria-label={`Navigate to ${store.name}`} href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`} target="_blank" rel="noreferrer"><Navigation size={18}/></a>}</div>}
    <button className="button clock-primary" disabled={!enabled||busy||reading||!store} onClick={()=>void clock()}><LocateFixed size={19} className={reading?'clock-locating':''}/>{reading?'Finding your precise location…':'Use my location & clock in'}{!reading&&<ArrowUpRight size={18}/>}</button><p className="clock-privacy"><ShieldCheck size={13}/>Location is checked on request. No background tracking.</p></>}
  </div><div className={`clock-signal ${fix?(inside?'is-inside':'is-outside'):''}`}>
   <div className="clock-radar" aria-hidden="true"><span/><span/><span/><div><LocateFixed size={30}/></div></div>
   <span className="clock-signal-label">{fix?'DISTANCE FROM OUTLET':'YOUR CHECK-IN ZONE'}</span><strong>{fix?Math.round(fix.distance):radius}<small>m</small></strong><span className="clock-signal-status">{reading?'Listening for GPS…':fix?(inside?'You’re within range':'Move closer to clock in'):'Choose an outlet. Get in range.'}</span>
   {fix?<div className="clock-signal-meta"><span><Signal size={13}/>Accuracy ±{Math.ceil(fix.accuracy)}m</span><span>Boundary {radius}m</span></div>:<div className="clock-signal-meta"><span><Compass size={13}/>Precise GPS required</span></div>}
  </div></div>
  {!enabled&&<p className="clock-notice" role="alert">Your company has paused GPS check-in. Contact your manager.</p>}{notice&&<p className={`clock-notice ${fix&&!inside?'is-warning':''}`} role="status">{notice}</p>}{message&&<p className="clock-notice" role="status">{message}</p>}
  {fix&&!inside&&<details className="clock-review"><summary>Already at the outlet, but the saved position looks wrong?</summary><p>Send your current GPS position for manager review. Only an approved correction changes the outlet’s saved location.</p>{reviewSent?<span className="clock-confirm"><Check size={15}/>Sent for manager review</span>:<><label className="platform-check"><input type="checkbox" checked={atEntrance} onChange={e=>setAtEntrance(e.target.checked)}/>I am at the selected outlet’s entrance.</label><button className="small-button" disabled={!atEntrance||busy||reading} onClick={()=>void requestReview()}>Send location for manager review <ArrowUpRight size={14}/></button></>}</details>}
  <div className="clock-steps"><div><span>1</span><p><strong>Pick the right outlet</strong>Match the name to where you’re visiting.</p></div><div><span>2</span><p><strong>Stand at the entrance</strong>Be within {radius}m. Outdoors gives a better fix.</p></div><div><span>3</span><p><strong>Allow precise location</strong>Tap clock-in and wait for confirmation.</p></div></div>
  <details className="clock-help"><summary>Location help <SquareArrowOutUpRight size={14}/></summary><div><p><strong>Android / Chrome:</strong> Turn on phone Location. In Chrome, open this site’s permissions and allow Location. In Android Settings → Apps → Chrome → Permissions → Location, allow while using the app and enable precise location.</p><p><strong>iPhone / Safari:</strong> Settings → Privacy &amp; Security → Location Services → Safari Websites → While Using, with Precise Location on. Allow this website’s location request.</p><p><strong>Still showing the wrong distance?</strong> Confirm the selected outlet, step outside, wait a few seconds and retry. If you are at the entrance and GPS still places you far away, ask your manager to check the saved outlet position. The app does not move an outlet’s position automatically.</p></div></details>
  {shift&&!open&&<button className="clock-out" disabled={busy||reading} onClick={()=>void submit({action:'shift',company_id:s.company.id,operation:'out'})}>Finished for now? Clock out <ArrowUpRight size={14}/></button>}
 </section>;
}
