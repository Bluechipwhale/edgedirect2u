import { requireRole,publishedTheme,catalogue,records } from '@/lib/server';
import { ThemePreview } from '@/components/theme-preview';
export const metadata={title:'Theme preview',robots:{index:false,follow:false}};
export default async function Page(){await requireRole(['admin']);const [initial,data,banners,merchants]=await Promise.all([publishedTheme(),catalogue(),records('banners'),records('merchants')]);return <ThemePreview initial={initial} {...data} banners={banners} merchants={merchants}/>;}
