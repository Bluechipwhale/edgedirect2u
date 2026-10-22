import {beforeEach,expect,it,vi} from 'vitest';
import {defaultTheme} from '../src/lib/theme';
const mock=vi.hoisted(()=>({client:vi.fn()}));
vi.mock('@/lib/server',()=>({supabase:mock.client}));
import {companySnapshot} from '../src/lib/platform-server';
const company='10000000-0000-4000-8000-000000000001',agent='qa-agent';
const oldAssignment={id:'old-assignment',company_id:company,agent_id:agent,store_id:'old-store',visit_date:'2026-09-01'};
const oldVisit={id:'old-visit',company_id:company,agent_id:agent,assignment_id:oldAssignment.id,started_at:'2026-09-01T10:00:00Z',completed_at:null,override_reason:null,task_report:null};
function fixture(open=true,denied=false){
 const calls:{table:string;filters:Record<string,unknown>}[]=[];
 const db={auth:{getUser:async()=>({data:{user:{id:agent}},error:null})},rpc:async(name:string)=>({error:null,data:name==='company_context'?{id:company,slug:'e-edge-direct-2u',brand:defaultTheme,brand_draft:defaultTheme}:name==='company_role'?'field_agent':name==='field_schedule'?[]:name==='company_metrics'?{stores:1,planned:0,completed:0,agents:1}:null}),from(table:string){
  const filters:Record<string,unknown>={};const builder={select(){return builder;},eq(key:string,value:unknown){filters[key]=value;return builder;},is(key:string,value:unknown){filters[key]=value;return builder;},in(key:string,value:unknown){filters[key]=value;return builder;},order(){return builder;},limit(){return builder;},then(resolve:(value:unknown)=>unknown){
   calls.push({table,filters:{...filters}});const active=table==='field_visits'&&'completed_at' in filters;
   const data=active?(open?[oldVisit]:[]):table==='field_assignments'?[oldAssignment]:table==='field_stores'&&filters.id?[{id:'old-store',company_id:company,name:'Previous outlet'}]:[];
   return Promise.resolve({data,error:active&&denied?{message:'Denied'}:null}).then(resolve);
  }};return builder;
 }};mock.client.mockResolvedValue(db);return calls;
}
beforeEach(()=>vi.resetAllMocks());
it('loads the signed-in agent’s old open visit, assignment and outlet outside the recent window',async()=>{
 const calls=fixture();const result=await companySnapshot('e-edge-direct-2u');expect(result.visits).toContainEqual(oldVisit);expect(result.assignments).toContainEqual(oldAssignment);expect(result.stores.map(s=>s.id)).toContain('old-store');
 const active=calls.find(c=>c.table==='field_visits'&&'completed_at' in c.filters);expect(active?.filters).toEqual({company_id:company,agent_id:agent,completed_at:null});expect(calls.find(c=>c.table==='field_assignments')?.filters).toEqual({company_id:company,agent_id:agent,id:['old-assignment']});
});
it('does not fetch historical assignments when the agent has no unfinished visit',async()=>{
 const calls=fixture(false);const result=await companySnapshot('e-edge-direct-2u');expect(result.assignments).toEqual([]);expect(calls.some(c=>c.table==='field_assignments')).toBe(false);
});
it('reports an unavailable open visit instead of concealing an authorization failure',async()=>{
 fixture(true,true);await expect(companySnapshot('e-edge-direct-2u')).rejects.toThrow('Your open visit could not be loaded');
});
