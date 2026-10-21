export function cataloguePage(value:unknown):number {
  const first=Array.isArray(value)?value[0]:value;
  const number=typeof first==='string'||typeof first==='number'?Number(first):NaN;
  return Number.isFinite(number)?Math.min(10000,Math.max(1,Math.floor(number))):1;
}
export function cataloguePrice(value:number,fallback:number):number {
  return Number.isFinite(value)?Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,Math.round(value))):fallback;
}
export function catalogueSearchParams(raw:Record<string,string|string[]|undefined>):Record<string,string|undefined> {
  return Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));
}
