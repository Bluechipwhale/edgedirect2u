// Local browser-test fixture only. No route, user, GPS or attendance is written to Supabase.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CompanyWorkspace} from '../../src/components/company-workspace';
import {FieldClock} from '../../src/components/field-clock';
import {FieldDayHero} from '../../src/components/field-day-hero';
import {defaultTheme,themeTokens} from '../../src/lib/theme';
import {FLAGSHIP_ID,type CompanySnapshot} from '../../src/lib/platform-contract';
const agent='30000000-0000-4000-8000-000000000001',today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const stores=Array.from({length:4},(_,i)=>({id:`30000000-0000-4000-8000-${String(i+10).padStart(12,'0')}`,company_id:FLAGSHIP_ID,name:i===3?'TEST ONLY — GPS clock-in verification':`Sample outlet ${i+1}`,address:'Local QA sample address · Lagos',latitude:6.5,longitude:3.4,radius_metres:50,route:i===3?'':'Sample route',route_sequence:i===3?null:i+1,is_test:i===3}));
const assignments=stores.map((s,i)=>({id:`30000000-0000-4000-8000-${String(i+20).padStart(12,'0')}`,company_id:FLAGSHIP_ID,store_id:s.id,agent_id:agent,visit_date:today}));
export const sample:CompanySnapshot={company:{id:FLAGSHIP_ID,slug:'e-edge-direct-2u',name:'E-Edge Direct 2U',address:'QA preview',active:true,package:'field_operations',brand:defaultTheme,brand_draft:defaultTheme,geofence_metres:100,daily_target:30,allow_web_checkin:true},actorId:agent,role:'field_agent',members:[{company_id:FLAGSHIP_ID,user_id:agent,role:'field_agent',active:true,label:'Timothy QA'}],stores,assignments,visits:[],shifts:[],modules:[{module:'field_operations',enabled:true}],versions:[],metrics:{stores:3,planned:3,completed:0,agents:1}};
function Preview(){
 const mode=new URL(location.href).searchParams.get('mode');
 const [snapshot,setSnapshot]=useState<CompanySnapshot>(()=>mode==='previous-visit'?{...sample,assignments:sample.assignments.map((a,i)=>i===0?{...a,visit_date:'2026-09-01'}:a),visits:[{id:'30000000-0000-4000-8000-000000000090',assignment_id:assignments[0].id,agent_id:agent,started_at:'2026-09-01T10:00:00Z',completed_at:null,override_reason:null,task_report:null}],shifts:[{id:'30000000-0000-4000-8000-000000000091',agent_id:agent,started_at:'2026-09-01T10:00:00Z',ended_at:null}]}:sample);
 function started(){setSnapshot({...sample,visits:[{id:'30000000-0000-4000-8000-000000000099',assignment_id:assignments[3].id,agent_id:agent,started_at:new Date().toISOString(),completed_at:null,override_reason:null,task_report:null}],shifts:[{id:'30000000-0000-4000-8000-000000000098',agent_id:agent,started_at:new Date().toISOString(),ended_at:null,test_only:true}]});}
 return <><div style={{padding:8,textAlign:'center',fontSize:10,background:'#fff4cf',color:'#705517'}}>LOCAL QA PREVIEW · SAMPLE DATA · NO LIVE ATTENDANCE</div>{mode==='clock'?<div className="platform-root field-workspace" style={themeTokens(defaultTheme)}><main className="platform-main"><FieldDayHero snapshot={snapshot} onVisits={()=>{}} onRoute={()=>{}}/><FieldClock snapshot={snapshot} onStarted={started}/></main></div>:<CompanyWorkspace snapshot={snapshot} fieldMode/>}</>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
