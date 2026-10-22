import 'server-only';
import { supabase } from './server';
import { themeSchema,defaultTheme } from './theme';
import type { Company,CompanySnapshot,CompanyRole } from './platform-contract';
export async function platformIdentity(){const db=await supabase();const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error('Authentication required');const claim=await db.rpc('company_claim_staff');if(claim.error)throw new Error('Staff access could not be activated');return {db,user};}
export async function platformOverview(){const {db}=await platformIdentity();const {data:allowed,error}=await db.rpc('platform_is_admin');if(error||!allowed)throw new Error('Platform administrator with verified MFA required');const [{data:companies,error:ce},{data:audit,error:ae}]=await Promise.all([db.from('platform_companies').select('*').order('created_at',{ascending:false}).limit(100),db.from('platform_audit').select('id,action,company_id,created_at').order('created_at',{ascending:false}).limit(30)]);if(ce||ae)throw new Error('Platform data unavailable');return {companies:(companies||[]) as Company[],audit:audit||[]};}
export async function companySnapshot(slug:string):Promise<CompanySnapshot>{
  const {db,user}=await platformIdentity();const {data:company,error}=await db.rpc('company_context',{p_slug:slug});if(error||!company)throw new Error('Company unavailable or access denied');
  const {data:role}=await db.rpc('company_role',{p_company:company.id});if(!role)throw new Error('Company membership required');
  const id=company.id;if(role==='field_agent'){const prepared=await db.rpc('field_prepare_day',{p_company:id});if(prepared.error)throw new Error('Your route could not be prepared');}const results=await Promise.all([
    db.from('platform_memberships').select('*').eq('company_id',id),db.from('field_stores').select('*').eq('company_id',id).order('name').limit(40),
    db.rpc('field_schedule',{p_company:id}),
    db.from('field_visits').select('id,assignment_id,agent_id,started_at,completed_at,override_reason,task_report').eq('company_id',id).order('started_at',{ascending:false}).limit(200),
    db.from('field_shifts').select('id,agent_id,started_at,ended_at,test_only').eq('company_id',id).order('started_at',{ascending:false}).limit(100),
    db.from('platform_modules').select('module,enabled').eq('company_id',id),db.from('platform_brand_versions').select('id,created_at').eq('company_id',id).order('created_at',{ascending:false}).limit(10),db.rpc('company_metrics',{p_company:id}),
  ]);if(results.some(r=>r.error))throw new Error('Company workspace unavailable');
  const [members,stores,assignments,visits,shifts,modules,versions,metrics]=results.map(r=>r.data||[]);
  if(role==='field_agent'){
    // An unfinished visit must remain recoverable beyond the recent-history window.
    const open=await db.from('field_visits').select('id,assignment_id,agent_id,started_at,completed_at,override_reason,task_report').eq('company_id',id).eq('agent_id',user.id).is('completed_at',null).order('started_at').limit(1);
    if(open.error)throw new Error('Your open visit could not be loaded');
    for(const visit of open.data||[])if(!visits.some((v:{id:string})=>v.id===visit.id))visits.push(visit);
    const missingAssignments=(open.data||[]).map(v=>v.assignment_id).filter(aid=>!assignments.some((a:{id:string})=>a.id===aid));
    if(missingAssignments.length){
      const previous=await db.from('field_assignments').select('*').eq('company_id',id).eq('agent_id',user.id).in('id',missingAssignments);
      if(previous.error||previous.data?.length!==missingAssignments.length)throw new Error('Your open visit assignment could not be loaded');
      assignments.push(...previous.data);
    }
  }
  const missing=[...new Set((assignments as {store_id:string}[]).map(a=>a.store_id))].filter(id=>!(stores as {id:string}[]).some(s=>s.id===id));if(missing.length){const extra=await db.from('field_stores').select('*').eq('company_id',id).in('id',missing);if(extra.error)throw new Error('Assigned stores unavailable');stores.push(...(extra.data||[]));}
  return {company:{...company,brand:themeSchema.safeParse(company.brand).success?company.brand:defaultTheme,brand_draft:themeSchema.safeParse(company.brand_draft).success?company.brand_draft:company.brand},role:role as CompanyRole,actorId:user.id,metrics,members,stores,assignments,visits,shifts,modules,versions} as CompanySnapshot;
}
