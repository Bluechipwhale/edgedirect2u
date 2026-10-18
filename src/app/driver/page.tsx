import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platformIdentity} from '@/lib/platform-server';
import {driverDestination} from '@/lib/driver-destination';
import { requireRole,records,supabase } from '@/lib/server';
import { DriverAvailability } from '@/components/driver-availability';
import { DriverInstall } from '@/components/driver-install';
import { Operations } from '@/components/operations';
export const metadata={title:'Driver workspace',robots:{index:false,follow:false},manifest:'/manifest.webmanifest'};
export default async function Page(){
  const identity=await platformIdentity().catch(()=>null);
  if(identity){
    const [profile,companies,business]=await Promise.all([identity.db.from('profiles').select('role').eq('id',identity.user.id).single(),identity.db.rpc('my_company_workspaces'),identity.db.rpc('business_context')]);
    if(profile.error||companies.error||business.error)throw new Error('Your workspace could not load. Please try again.');
    const destination=driverDestination(profile.data?.role,companies.data||[],business.data?.role);
    if(destination)redirect(destination);
  }
  let a;try{a=await requireRole(['driver']);}catch{return <div className="container narrow-page"><h1>Your delivery day, simplified.</h1><p>Sign in with your approved driver or van-sales account to open your work.</p><Link className="button" href="/login?next=/driver">Driver sign in</Link><p><Link className="text-button" href="/field/e-edge-direct-2u">Store visits & field operations →</Link></p></div>;}
  const {data:driver}=await(await supabase()).from('drivers').select('available').eq('user_id',a.id).single();const jobs=(await records('deliveries')).filter(j=>j.data.driver_id===a.id);return <div className="container catalog-page"><Link className="text-button" href="/">← Storefront</Link><h1 className="section">Your delivery day.</h1><p>Only deliveries assigned to your account appear here.</p><p><Link className="text-button" href="/field/e-edge-direct-2u">Store visits, shifts & field history →</Link></p><p><Link className="text-button" href="/staff">Van stock & sales (approved sales staff) →</Link></p><DriverInstall/>{driver&&<DriverAvailability available={driver.available}/>}<Operations kind="driver" jobs={jobs}/></div>;
}
