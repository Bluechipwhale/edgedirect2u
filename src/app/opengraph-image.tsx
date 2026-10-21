import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publishedTheme } from '@/lib/server';
export const alt='E-Edge Direct 2U — Commerce. Delivery. Distribution.';
export const size={width:1200,height:630};
export const contentType='image/png';
export default async function Image(){
  const t=await publishedTheme();
  const official=(t.lightLogo||t.logo).includes('e-edge-direct-2u-mark-20261021');
  const logo=official?`data:image/png;base64,${(await readFile(join(process.cwd(),'public/brand/e-edge-direct-2u-mark-20261021.png'))).toString('base64')}`:t.lightLogo||t.logo;
  // ImageResponse renders its own HTML image; next/image cannot run in this canvas.
  /* eslint-disable @next/next/no-img-element */
  return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:t.background,color:t.text,padding:72,flexDirection:'column',justifyContent:'space-between',fontFamily:'sans-serif'}}><div style={{display:'flex',alignItems:'center',gap:24,fontSize:32,fontWeight:700}}>{logo?<img src={logo} alt={t.name} width={official?120:225} height={108} style={{objectFit:'contain'}}/>:<span>{t.name.charAt(0)}</span>}{t.name}</div><div style={{display:'flex',flexDirection:'column',gap:24}}><span style={{fontSize:78,letterSpacing:-4,lineHeight:1.08,fontWeight:700,maxWidth:950}}>{t.heroTitle.replace(/\n/g,' ')}</span><span style={{fontSize:28,color:t.muted,maxWidth:900}}>{t.tagline}</span></div><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderTop:`1px solid ${t.border}`,paddingTop:24,fontSize:22}}><span>Your everyday, with an edge.</span><span style={{color:t.primary}}>Discover the collection ↗</span></div></div>,size);
}
