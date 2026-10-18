export type FieldLocation={latitude:number;longitude:number;accuracy:number;captured:string};
export function metresBetween(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
 const radians=(n:number)=>n*Math.PI/180;const lat=radians(b.latitude-a.latitude),lng=radians(b.longitude-a.longitude);
 const h=Math.sin(lat/2)**2+Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(lng/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function storeRadius(company:{id:string;geofence_metres:number},store:{radius_metres:number|null}){return company.id==='10000000-0000-4000-8000-000000000001'?Math.min(100,company.geofence_metres):store.radius_metres??company.geofence_metres;}
type Geo=Pick<Geolocation,'watchPosition'|'clearWatch'>;
export function readFieldLocation(geo:Geo,options:{signal?:AbortSignal;target?:{latitude:number;longitude:number;radius:number};onProgress?:(accuracy:number)=>void;timeoutMs?:number}={}):Promise<FieldLocation>{
 return new Promise((resolve,reject)=>{
  let id:number|undefined,best:GeolocationPosition|undefined,settled=false;
  const stop=()=>{if(id!==undefined)geo.clearWatch(id);clearTimeout(timer);options.signal?.removeEventListener('abort',abort);};
  const finish=(error?:Error,p?:GeolocationPosition)=>{if(settled)return;settled=true;stop();if(error)reject(error);else if(p)resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,captured:new Date(p.timestamp).toISOString()});};
  const abort=()=>finish(new DOMException('Location request cancelled','AbortError'));
  const timer=setTimeout(()=>{if(best&&best.coords.accuracy<=50&&Date.now()-best.timestamp<55000)finish(undefined,best);else finish(new Error(best?`GPS accuracy is ±${Math.ceil(best.coords.accuracy)}m. Enable precise location and try again outdoors at the store.`:'No fresh GPS reading arrived. Enable location services and precise location, then try again at the store.'));},options.timeoutMs??30000);
  if(options.signal?.aborted){abort();return;}options.signal?.addEventListener('abort',abort,{once:true});
  try{id=geo.watchPosition(p=>{
   const c=p.coords;if(![c.latitude,c.longitude,c.accuracy,p.timestamp].every(Number.isFinite)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||c.accuracy<0||Date.now()-p.timestamp>55000||p.timestamp>Date.now()+5000)return;
   if(!best||c.accuracy<best.coords.accuracy)best=p;options.onProgress?.(c.accuracy);
   const inside=options.target&&metresBetween(c,options.target)+c.accuracy<=options.target.radius;
   if(c.accuracy<=50&&(c.accuracy<=15||inside))finish(undefined,p);
  },error=>{if(error.code===1)finish(new Error('Location permission was denied. Allow location for this website in your browser, then enable precise location in your phone settings. Open Location help below for the steps.'));else if(!best)finish(new Error('GPS is unavailable. Turn on phone location, move outdoors at the outlet, and retry.'));},{enableHighAccuracy:true,maximumAge:0,timeout:options.timeoutMs??30000});if(settled)geo.clearWatch(id);}catch{finish(new Error('Location could not start. Open the secure field page in your phone browser and allow precise location.'));}
 });
}
