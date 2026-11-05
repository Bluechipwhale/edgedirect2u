import Link from 'next/link';
import {LogoutButton} from '@/components/logout-button';
export const metadata={title:'Log out',robots:{index:false,follow:false}};
export default function Page(){return <main className="container narrow-page"><h1>Log out of your account</h1><p>Sign out of E-Edge Direct 2U in this browser. Your account and saved business records stay intact.</p><LogoutButton/><p><Link href="/">Back to storefront</Link></p></main>;}
