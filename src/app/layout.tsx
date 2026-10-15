import type { Metadata } from 'next';
import { connection } from 'next/server';
import { ShopProvider } from '@/components/shop-state';
import { publishedTheme } from '@/lib/server';
import { AppLifecycle } from '@/components/app-install';
import './globals.css';
export async function generateMetadata():Promise<Metadata> {const theme=await publishedTheme();return {title:{default:theme.seoTitle,template:`%s | ${theme.name}`},description:theme.seoDescription,metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://edgedirect2u.com'),manifest:'/store.webmanifest',appleWebApp:{capable:true,title:theme.name,statusBarStyle:'default'},icons:{apple:'/icons/driver-192.png',...(theme.favicon?{icon:theme.favicon}:{})},openGraph:{title:theme.seoTitle,description:theme.seoDescription}};}
export default async function RootLayout({children}:{children:React.ReactNode}) {await connection();return <html lang="en" data-scroll-behavior="smooth"><body><ShopProvider><AppLifecycle/>{children}</ShopProvider></body></html>;}
