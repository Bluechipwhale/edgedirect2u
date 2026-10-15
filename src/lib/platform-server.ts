import 'server-only';
import { supabase } from './server';
import { themeSchema,defaultTheme } from './theme';
import type { Company,CompanySnapshot,CompanyRole } from './platform-contract';
export async function platformIdentity(){const db=await supabase();const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error('Authentication required');return {db,user};}
export async function platformOverview(){const {db}=await platformIdentity();const {data:allowed,error}=await db.rpc('platform_is_admin');if(error||!allowed)throw new Error('Platform administrator with verified MFA required');const [{data:companies,error:ce},{data:audit,error:ae}]=await Promise.all([db.from('platform_companies').select('*').order('created_at',{ascending:false}).limit(100),db.from('platform_audit').select('id,action,company_id,created_at').order('created_at',{ascending:false}).limit(30)]);if(ce||ae)throw new Error('Platform data unavailable');return {companies:(companies||[]) as Company[],audit:audit||[]};}
export async function companySnapshot(slug:string):Promise<CompanySnapshot>{
  const {db,user}=await platformIdentity();const {data:company,error}=await db.rpc('company_context',{p_slug:slug});if(error||!company)throw new Error('Company unavailable or access denied');
  const {data:role}=await db.rpc('company_role',{p_company:company.id});if(!role)throw new Error('Company membership required');
  const id=company.id;const results=await Promise.all([
    db.from('platform_memberships').select('*').eq('company_id',id),db.from('field_stores').select('*').eq('company_id',id).order('name').limit(200),
    db.from('field_assignments').select('*').eq('company_id',id).gte('visit_date',new Date(Date.now()-7*86400000).toISOString().slice(0,10)).lte('visit_date',new Date(Date.now()+14*86400000).toISOString().slice(0,10)).order('visit_date',{ascending:true}).limit(200),
    db.from('field_visits').select('id,assignment_id,agent_id,started_at,completed_at,override_reason,task_report').eq('company_id',id).order('started_at',{ascending:false}).limit(200),
    db.from('field_shifts').select('id,agent_id,started_at,ended_at').eq('company_id',id).order('started_at',{ascending:false}).limit(100),
    db.from('platform_modules').select('module,enabled').eq('company_id',id),db.from('platform_brand_versions').select('id,created_at').eq('company_id',id).order('created_at',{ascending:false}).limit(10),db.rpc('company_metrics',{p_company:id}),
  ]);if(results.some(r=>r.error))throw new Error('Company workspace unavailable');
  const [members,stores,assignments,visits,shifts,modules,versions,metrics]=results.map(r=>r.data||[]);
  return {company:{...company,brand:themeSchema.safeParse(company.brand).success?company.brand:defaultTheme,brand_draft:themeSchema.safeParse(company.brand_draft).success?company.brand_draft:company.brand},role:role as CompanyRole,actorId:user.id,metrics,members,stores,assignments,visits,shifts,modules,versions} as CompanySnapshot;
}
