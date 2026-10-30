import {supabase,configured} from '@/lib/server';
import {ContactForm} from '@/components/support-forms';
export const metadata={title:'Contact & support'};
export default async function Page(){const user=configured()?(await(await supabase()).auth.getUser()).data.user:null;return <main className="container narrow-page"><span className="eyebrow">HERE TO HELP</span><h1>Let’s sort it out.</h1><p>Ask about an order, delivery or product. Keep passwords and payment card details out of your message.</p><ContactForm email={user?.email||''}/></main>;}
