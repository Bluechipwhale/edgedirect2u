import { NextResponse } from 'next/server';
import { guard,failure } from '@/lib/http';
import { platformCommand } from '@/lib/platform-contract';
import { platformIdentity } from '@/lib/platform-server';
import { defaultTheme,assertPublishable } from '@/lib/theme';
export async function POST(req:Request){try{
  guard(req);const {db}=await platformIdentity();const text=await req.text();if(text.length>30000)throw new Error('Request too large');const c=platformCommand.parse(JSON.parse(text));
  let rpc:string;let args:Record<string,unknown>;
  switch(c.action){
    case 'create-company':rpc='platform_create_company';args={p_slug:c.slug,p_name:c.name,p_owner_email:c.owner,p_package:c.package,p_brand:{...defaultTheme,name:c.name.slice(0,60),seoTitle:c.name,logo:'',lightLogo:'',darkLogo:'',mobileLogo:'',favicon:'',copyright:`© ${new Date().getFullYear()} ${c.name}`,tagline:'Your company workspace',description:'',seoDescription:''}};break;
    case 'activation':rpc='platform_set_active';args={p_company:c.company_id,p_active:c.active};break;
    case 'member':rpc='company_set_member';args={p_company:c.company_id,p_email:c.email,p_role:c.role,p_active:c.active};break;
    case 'brand':if(c.operation==='publish')assertPublishable(c.config);rpc='company_brand';args={p_company:c.company_id,p_action:c.operation,p_config:c.config,p_version:c.version||null};break;
    case 'policy':rpc='company_field_policy';args={p_company:c.company_id,p_radius:c.radius,p_target:c.target,p_web:c.web};break;
    case 'store':rpc='field_save_store';args={p_company:c.company_id,p_name:c.name,p_address:c.address,p_lat:c.latitude,p_lng:c.longitude,p_radius:c.radius};break;
    case 'assignment':rpc='field_assign';args={p_company:c.company_id,p_store:c.store,p_agent:c.agent,p_date:c.date};break;
    case 'shift':rpc='field_shift';args={p_company:c.company_id,p_action:c.operation};break;
    case 'checkin':rpc='field_checkin';args={p_company:c.company_id,p_assignment:c.assignment,p_lat:c.latitude,p_lng:c.longitude,p_accuracy:c.accuracy,p_captured:c.captured};break;
    case 'override':rpc='field_override';args={p_company:c.company_id,p_assignment:c.assignment,p_reason:c.reason};break;
    case 'complete':rpc='field_complete';args={p_company:c.company_id,p_visit:c.visit,p_report:c.report};break;
  }
  const {data,error}=await db.rpc(rpc,args);if(error)throw new Error(error.message);return NextResponse.json({ok:true,id:data},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
