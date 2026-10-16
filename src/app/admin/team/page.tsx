import {companySnapshot} from '@/lib/platform-server';
import {TeamManager} from '@/components/team-manager';
export const metadata={title:'Staff & van salespeople'};
export default async function Page(){const s=await companySnapshot('e-edge-direct-2u');return <><div className="page-heading"><div><span className="eyebrow">PEOPLE & ACCESS</span><h1>Staff & van salespeople</h1><p>Register your team, send secure invitations and manage access.</p></div></div><TeamManager company={s.company.id}/></>;}
