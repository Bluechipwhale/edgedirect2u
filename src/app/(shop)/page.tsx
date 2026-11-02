import { catalogue, publishedTheme, records } from '@/lib/server';
import {liveDealPlacements} from '@/lib/live-deals';
import { Storefront } from '@/components/storefront';
export default async function Home() { const [data,theme,banners,merchants,deals]=await Promise.all([catalogue(),publishedTheme(),records('banners',true),records('merchants',true),liveDealPlacements()]);return <Storefront theme={theme} {...data} banners={banners} merchants={merchants} deals={deals}/>; }

