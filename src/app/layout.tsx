import type { Metadata } from 'next';
import { connection } from 'next/server';
import { ShopProvider } from '@/components/shop-state';
import { publishedTheme } from '@/lib/server';
import './globals.css';
export async function generateMetadata():Promise<Metadata> {const theme=await publishedTheme();return {title:{default:theme.seoTitle,template:`%s | ${theme.name}`},description:theme.seoDescription,metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://edgedirect2u.com'),...(theme.favicon?{icons:{icon:theme.favicon}}:{}),openGraph:{title:theme.seoTitle,description:theme.seoDescription}};}
export default async function RootLayout({children}:{children:React.ReactNode}) {await connection();return <html lang="en" data-scroll-behavior="smooth"><body><ShopProvider>{children}</ShopProvider></body></html>;}
