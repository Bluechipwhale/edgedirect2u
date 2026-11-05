import { AuthForm } from '@/components/auth-form';
import { workspacePath } from '@/lib/workspace-path';
import {configured,supabase} from '@/lib/server';
export default async function Page({searchParams}:{searchParams:Promise<{next?:string|string[];logged_out?:string}>}){const p=await searchParams;let loggedOut=false;if(p.logged_out==='1'&&configured()){try{const {data:{user},error}=await(await supabase()).auth.getUser();loggedOut=!user&&(!error||error.name==='AuthSessionMissingError');}catch{}}return <AuthForm returnTo={workspacePath(p.next)} loggedOut={loggedOut}/>;}
