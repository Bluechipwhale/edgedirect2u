import { catalogue, publishedTheme, records } from '@/lib/server';
import { Storefront } from '@/components/storefront';
export default async function Home() { const [data,theme,banners,merchants]=await Promise.all([catalogue(),publishedTheme(),records('banners',true),records('merchants',true)]);return <Storefront theme={theme} {...data} banners={banners} merchants={merchants}/>; }

