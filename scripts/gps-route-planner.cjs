// Local-only GPS planning: no customer location is sent to a geocoding provider.
const rad=x=>x*Math.PI/180;
function distance(a,b){const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
const centre=rows=>({latitude:rows.reduce((n,r)=>n+r.latitude,0)/rows.length,longitude:rows.reduce((n,r)=>n+r.longitude,0)/rows.length});
const diameter=rows=>rows.reduce((m,a,i)=>Math.max(m,...rows.slice(i+1).map(b=>distance(a,b))),0);
const places=['Adeniyi Jones','Iyana Ipaja','Abule Egba','Victoria Island','Lagos Island','Oke Aro','Oke Ira','Alagbole','Agidingbi','Onigbongbo','Oregun','Alausa','Opebi','Allen','Ogba','Ojodu','Omole','Agege','Ifako','Iju','Ojokoro','Egbeda','Alimosho','Ojota','Ketu','Maryland','Ilupeju','Oshodi','Mushin','Yaba','Surulere','Gbagada','Ogudu','Magodo','Isheri','Berger','Ikorodu','Lekki','Isolo','Ejigbo','Ikotun','Ibafo','Mowe','Sango','Akute','Ota','Ikeja'];
function area(rows){const hits=new Map;for(const row of rows){const text=String(row.address||'').toLowerCase();const place=places.find(p=>new RegExp('\\b'+p.toLowerCase().replace(/ /g,'\\s+')+'\\b').test(text));if(place)hits.set(place,(hits.get(place)||0)+1);}return [...hits].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||'Local area';}
function sequence(rows){
 const c=centre(rows),left=[...rows].sort((a,b)=>distance(b,c)-distance(a,c)||a.id.localeCompare(b.id)),out=[left.shift()];
 while(left.length){left.sort((a,b)=>distance(out.at(-1),a)-distance(out.at(-1),b)||a.id.localeCompare(b.id));out.push(left.shift());}
 // Deterministic 2-opt improves the open path; this is not a road-time estimate.
 for(let pass=0;pass<4;pass++){let changed=false;for(let i=0;i<out.length-3;i++)for(let j=i+2;j<out.length-1;j++){const before=distance(out[i],out[i+1])+distance(out[j],out[j+1]),after=distance(out[i],out[j])+distance(out[i+1],out[j+1]);if(after+0.00001<before){out.splice(i+1,j-i,...out.slice(i+1,j+1).reverse());changed=true;}}if(!changed)break;}
 return out;
}
function plan(outlets,{minimum=10,target=25,maximum=35,maxDiameterKm=4}={}){
 if(minimum<10||target<minimum||maximum<target||maxDiameterKm<=0)throw Error('Invalid route limits');
 if(new Set(outlets.map(r=>r.id)).size!==outlets.length)throw Error('Duplicate outlet IDs');
 const valid=outlets.filter(r=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)&&r.latitude>=4&&r.latitude<=14&&r.longitude>=2&&r.longitude<=15),review=outlets.filter(r=>!valid.includes(r)).map(r=>({...r,reason:'Missing or invalid source GPS'}));
 const groups=[],remaining=[...valid].sort((a,b)=>a.longitude-b.longitude||a.latitude-b.latitude||a.id.localeCompare(b.id));
 while(remaining.length>=minimum){
  // Start from the edge, requiring a viable compact neighbourhood before taking it.
  let selected=null;
  for(const seed of remaining){const near=remaining.map(r=>({r,d:distance(seed,r)})).filter(x=>x.d<=maxDiameterKm).sort((a,b)=>a.d-b.d||a.r.id.localeCompare(b.r.id));const group=[];for(const {r} of near){if(group.length>=target)break;if(group.every(p=>distance(p,r)<=maxDiameterKm))group.push(r);}if(group.length>=minimum){selected=group;break;}}
  if(!selected)break;groups.push(selected);const used=new Set(selected.map(r=>r.id));for(let i=remaining.length-1;i>=0;i--)if(used.has(remaining[i].id))remaining.splice(i,1);
 }
 for(const row of remaining){const candidates=groups.filter(g=>g.length<maximum&&g.every(p=>distance(row,p)<=maxDiameterKm)).sort((a,b)=>distance(row,centre(a))-distance(row,centre(b)));if(candidates.length)candidates[0].push(row);else review.push({...row,reason:'Fewer than 10 nearby outlets within the route diameter limit'});}
 const duplicate=new Map;valid.forEach(r=>{const k=`${r.latitude},${r.longitude}`;duplicate.set(k,(duplicate.get(k)||0)+1);});
 // Reference only, not a legal LGA boundary: https://www.geonames.org/advanced-search.html?q=Nigeria%2C+Africa&startRow=50
 const ikeja={latitude:6.596506,longitude:3.342052};
 const routes=groups.map(g=>{const c=centre(g);const ikejaAddresses=g.filter(r=>/\b(ikeja|oregun|alausa|opebi|allen|adeniyi\s+jones|agidingbi|onigbongbo)\b/i.test(r.address||'')).length;const shared=g.filter(r=>duplicate.get(`${r.latitude},${r.longitude}`)>=5).length;
  const ordered=sequence(g),a=area(g),qualifies=ikejaAddresses>=Math.ceil(g.length*0.6)&&distance(c,ikeja)<=7;
  return {area:a,ikeja:qualifies,centroid:c,count:g.length,diameter_km:diameter(g),straight_line_path_km:ordered.slice(1).reduce((n,r,i)=>n+distance(ordered[i],r),0),shared_coordinate_outlets:shared,stops:ordered.map((r,i)=>({...r,sequence:i+1,location_review_reason:duplicate.get(`${r.latitude},${r.longitude}`)>=5?'Several outlets share this saved coordinate. Confirm the exact storefront location.':''}))};
 }).sort((a,b)=>a.area.localeCompare(b.area)||a.centroid.longitude-b.centroid.longitude||a.centroid.latitude-b.centroid.latitude);
 const counts=new Map;for(const r of routes){const n=(counts.get(r.area)||0)+1;counts.set(r.area,n);r.name=`${r.ikeja&&['Alausa','Oregun','Opebi','Allen','Adeniyi Jones','Agidingbi','Onigbongbo'].includes(r.area)?'Ikeja / ':''}${r.area} — GPS Route ${String(n).padStart(2,'0')}`;}
 const candidates=routes.filter(r=>r.ikeja).sort((a,b)=>a.shared_coordinate_outlets-b.shared_coordinate_outlets||distance(a.centroid,ikeja)-distance(b.centroid,ikeja)||a.name.localeCompare(b.name));
 const assigned=candidates[0]||null;
 return {routes,review,assigned_route:assigned?.name||null,summary:{outlets:outlets.length,saved_gps:valid.length,routes:routes.length,routed:routes.reduce((n,r)=>n+r.count,0),review:review.length,minimum:routes.length?Math.min(...routes.map(r=>r.count)):0,maximum:routes.length?Math.max(...routes.map(r=>r.count)):0,max_diameter_km:routes.length?Math.max(...routes.map(r=>r.diameter_km)):0,shared_coordinate_outlets:valid.filter(r=>duplicate.get(`${r.latitude},${r.longitude}`)>=5).length}};
}
module.exports={plan,distance,sequence,area};
