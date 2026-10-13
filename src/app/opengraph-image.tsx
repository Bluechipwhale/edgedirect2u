import { ImageResponse } from 'next/og';
import { publishedTheme } from '@/lib/server';
export const alt='Edgedirect2u — Good finds. Great living.';
export const size={width:1200,height:630};
export const contentType='image/png';
export default async function Image(){
  const t=await publishedTheme();
  return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:t.background,color:t.text,padding:72,flexDirection:'column',justifyContent:'space-between',fontFamily:'sans-serif'}}><div style={{display:'flex',alignItems:'center',gap:18,fontSize:32,fontWeight:700}}><span style={{display:'flex',alignItems:'center',justifyContent:'center',background:t.primary,color:'white',width:56,height:56,borderRadius:12}}>↗</span>{t.name}</div><div style={{display:'flex',flexDirection:'column',gap:24}}><span style={{fontSize:78,letterSpacing:-4,lineHeight:1.08,fontWeight:700,maxWidth:950}}>{t.heroTitle.replace(/\n/g,' ')}</span><span style={{fontSize:28,color:t.muted,maxWidth:900}}>{t.tagline}</span></div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderTop:`1px solid ${t.border}`,paddingTop:24,fontSize:22}}><span>Your everyday, with an edge.</span><span style={{color:t.primary}}>Discover the collection ↗</span></div></div>,size);
}
