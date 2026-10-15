import { test,expect } from '@playwright/test';

test('company and platform workspaces require an authorized session',async({page,request})=>{
  await page.goto('/platform');await expect(page.getByRole('heading',{name:'Protected by a second factor.'})).toBeVisible();
  await page.goto('/company/e-edge-direct-2u');await expect(page.getByRole('heading',{name:'Your company. Your authorized team.'})).toBeVisible();
  await page.goto('/field/e-edge-direct-2u');await expect(page.getByRole('heading',{name:'A better field day starts here.'})).toBeVisible();
  const field=await request.get('/field/e-edge-direct-2u');expect(field.headers()['permissions-policy']).toContain('geolocation=(self)');expect(field.headers()['cache-control']).toContain('no-store');
  const home=await request.get('/');expect(home.headers()['permissions-policy']).toContain('geolocation=()');
  const denied=await request.post('/api/platform',{headers:{origin:'http://127.0.0.1:3100'},data:{action:'activation',company_id:'10000000-0000-4000-8000-000000000001',active:false}});expect(denied.ok()).toBe(false);
});
