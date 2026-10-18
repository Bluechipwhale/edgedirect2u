import {test,expect,type Page} from '@playwright/test';
import {build} from 'esbuild';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
let script='';
const fixturePath='/__local_field_fixture';
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:['tests/fixtures/field-preview.tsx'],bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve('src')},define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'local-next-stubs',setup(b){b.onResolve({filter:/^next\/(link|navigation|image)$/},args=>({path:args.path,namespace:'local-next'}));b.onLoad({filter:/.*/,namespace:'local-next'},args=>({loader:'jsx',resolveDir:process.cwd(),contents:args.path==='next/navigation'?`export const useRouter=()=>({refresh(){},push(){},replace(){}});export const usePathname=()=>'/field/e-edge-direct-2u';`:`import React from 'react';export default function Element({href,unoptimized,priority,prefetch,fill,scroll,replace,...props}){return React.createElement(${args.path==='next/image'?"'img'":"'a'"},{...props,${args.path==='next/image'?'':'href'}});}`}));}}]});
 script=bundle.outputFiles[0].text;mkdirSync('artifacts',{recursive:true});
});
async function fixture(page:Page,distance:number,mode='clock'){
 const styles=['store','admin','premium','platform','atelier','business','field'].map(name=>readFileSync(`src/app/${name}.css`,'utf8')).join('\n')+'\n'+readFileSync('src/app/globals.css','utf8').replace(/^@import.*$/gm,'');
 await page.route(`**${fixturePath}*`,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button,select{font:inherit}button{cursor:pointer}${styles}</style></head><body><div id="root"></div><script>${script.replaceAll('</script','<\\/script')}</script></body></html>`}));
 await page.addInitScript(({distance})=>{Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(success:PositionCallback){setTimeout(()=>success({coords:{latitude:6.5+distance/6371000*180/Math.PI,longitude:3.4,accuracy:5},timestamp:Date.now()} as GeolocationPosition),30);return 1;},clearWatch(){}}});},{distance});
 await page.route('**/api/field/reports?*',route=>route.fulfill({json:{from:'2026-10-18',to:'2026-10-18',timezone:'Africa/Lagos',count:3,page:1,page_size:100,summary:{assigned:3,visited:0,remaining:3,completed:0,in_progress:0},sales:{amount_kobo:0,units:0},rows:Array.from({length:3},(_,i)=>({assignment_id:`sample-${i}`,visit_date:'2026-10-18',outlet:`Sample outlet ${i+1}`,address:'Local QA sample address',route:'Sample route',route_sequence:i+1,salesperson:'Timothy QA',status:'assigned',completed_at:null}))}}));
 await page.goto(`${fixturePath}?mode=${mode}`);
}
test('requires an explicit outlet choice and explains a 300m rejection without posting attendance',async({page})=>{
 const actions:Record<string,unknown>[]=[];await page.route('**/api/platform',route=>{actions.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});});
 await fixture(page,300);const button=page.getByRole('button',{name:'Use my location & clock in'});
 await expect(button).toBeDisabled();await expect(page.getByLabel('Clock-in store')).toHaveValue('');
 await page.getByLabel('Clock-in store').selectOption({label:'TEST · TEST ONLY — GPS clock-in verification'});await button.click();
 await expect(page.getByRole('status').filter({hasText:'Your phone reports 300m'})).toBeVisible();await expect(page.getByText('Move closer to clock in',{exact:true})).toBeVisible();expect(actions).toHaveLength(0);
 await page.getByText('Location help',{exact:true}).click();await expect(page.getByText('Android / Chrome:',{exact:true})).toBeVisible();await expect(page.getByText('iPhone / Safari:',{exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/storefront-field-distance.png',fullPage:true});
 await page.getByText('Already at the outlet, but the saved position looks wrong?',{exact:true}).click();
 const review=page.getByRole('button',{name:'Send location for manager review'});await expect(review).toBeDisabled();await page.getByLabel('I am at the selected outlet’s entrance.').check();await review.click();
 await expect(page.getByText('Sent for manager review',{exact:true})).toBeVisible();expect(actions).toHaveLength(1);expect(actions[0]).toMatchObject({action:'location-proposal',accuracy:5});
 await expect(page.getByText('Clock-in confirmed',{exact:true})).toHaveCount(0);
});
test('accepts a precise 80m test fix, shows confirmation and offers a test-only clock-out',async({page})=>{
 const actions:Record<string,unknown>[]=[];await page.route('**/api/platform',async route=>{actions.push(route.request().postDataJSON());await route.fulfill({json:{ok:true,id:'30000000-0000-4000-8000-000000000099'}});});
 await fixture(page,80);await page.getByLabel('Clock-in store').selectOption({label:'TEST · TEST ONLY — GPS clock-in verification'});await page.getByRole('button',{name:'Use my location & clock in'}).click();
 await expect(page.getByText('Clock-in confirmed',{exact:true})).toBeVisible();expect(actions[0]).toMatchObject({action:'start-store',accuracy:5});
 await page.getByRole('button',{name:'Finish test & clock out'}).click();await expect.poll(()=>actions.length).toBe(2);expect(actions[1]).toMatchObject({action:'finish-test'});
});
test('renders the field dashboard at desktop and phone sizes without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:1365,height:1050});await fixture(page,0,'dashboard');await expect(page.getByRole('heading',{name:'Good energy. Great field days.'})).toBeVisible();
 await page.screenshot({path:'artifacts/storefront-field-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('navigation',{name:'Field navigation'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/storefront-field-mobile.png',fullPage:true});
 await page.getByText('Outlet breakdown',{exact:false}).click();await expect(page.locator('.vsr-outlets td[data-label="Outlet"]').filter({hasText:'Sample outlet 1'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/storefront-field-outlets.png',fullPage:true});
});
