'use client';
import { useState,useEffect,type CSSProperties } from 'react';
import { themeSchema,themeTokens,type Theme } from '@/lib/theme';
import { StoreHeader,StoreFooter } from './store-shell';
import { Storefront } from './storefront';
import type { Product,Category,RecordRow } from '@/lib/types';
export function ThemePreview({initial,products,categories,banners,merchants}:{initial:Theme;products:Product[];categories:Category[];banners:RecordRow[];merchants:RecordRow[]}){const [theme,setTheme]=useState(initial);useEffect(()=>{function receive(event:MessageEvent){if(event.origin!==window.location.origin||event.source!==window.parent||event.data?.type!=='edge-theme-preview')return;const result=themeSchema.safeParse(event.data.theme);if(result.success)setTheme(result.data);}window.addEventListener('message',receive);window.parent.postMessage({type:'edge-preview-ready'},window.location.origin);return()=>window.removeEventListener('message',receive);},[]);return <div style={themeTokens(theme) as CSSProperties} className="themed-store" data-buttons={theme.buttonStyle}><StoreHeader theme={theme} preview/><Storefront theme={theme} products={products} categories={categories} banners={banners} merchants={merchants} preview/><StoreFooter theme={theme}/></div>;}

