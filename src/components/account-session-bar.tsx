import Link from 'next/link';
import {configured,supabase} from '@/lib/server';
import {LogoutButton} from './logout-button';
export async function AccountSessionBar(){if(!configured())return null;try{const {data:{user},error}=await(await supabase()).auth.getUser();if(error||!user||user.is_anonymous)return null;}catch{return null;}return <aside className="account-session-bar" aria-label="Signed-in account controls"><span>Signed in</span><Link href="/workspaces">My workspaces</Link><LogoutButton/></aside>;}
