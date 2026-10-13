import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/account','/merchant','/driver','/api','/checkout','/login','/register','/forgot-password','/reset-password','/auth','/theme-preview']},sitemap:`${process.env.NEXT_PUBLIC_SITE_URL||'https://edgedirect2u.com'}/sitemap.xml`};}
