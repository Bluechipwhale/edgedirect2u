import {NextResponse} from 'next/server';
import {actor,supabase} from '@/lib/server';
import {guard,failure} from '@/lib/http';
import {teamDeskAction} from '@/lib/team-desk';
export async function POST(req:Request){try{guard(req);await actor();const raw=await req.text();if(raw.length>15000)throw Error('Request too large');const i=teamDeskAction.parse(JSON.parse(raw)),db=await supabase();let r;
 if(i.action==='contact')r=await db.rpc('save_team_contact',{p_company:i.company,p_agent:i.agent,p_name:i.name,p_relationship:i.relationship,p_phone:i.phone});
 else if(i.action==='schedule')r=await db.rpc('save_team_schedule',{p_id:i.id,p_company:i.company,p_agent:i.agent,p_label:i.label,p_start:i.start,p_end:i.end,p_notes:i.notes,p_active:i.active});
 else r=await db.rpc('send_team_message',{p_id:i.id,p_company:i.company,p_agent:i.agent,p_body:i.body});
 if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
