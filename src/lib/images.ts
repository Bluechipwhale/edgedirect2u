/** Optimize approved sources through Next; display other validated HTTPS assets directly. */
export function canOptimize(src:string){if(src.startsWith('/')&&!src.startsWith('//'))return true;try{const url=new URL(src);return url.protocol==='https:'&&(url.hostname==='images.unsplash.com'||url.hostname.endsWith('.supabase.co'));}catch{return false;}}
