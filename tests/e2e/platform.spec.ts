import { test,expect } from '@playwright/test';

test('company and platform workspaces require an authorized session',async({page,request})=>{
  await page.goto('/platform');await expect(page.getByRole('heading',{name:'Protected by a second factor.'})).toBeVisible();
  await page.goto('/company/e-edge-direct-2u');await expect(page.getByRole('heading',{name:'Your company. Your authorized team.'})).toBeVisible();
  await page.goto('/field/e-edge-direct-2u');await expect(page.getByRole('heading',{name:'A better field day starts here.'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Field team sign in'})).toHaveAttribute('href','/login?next=%2Ffield%2Fe-edge-direct-2u');
  await page.getByRole('link',{name:'Field team sign in'}).click();await expect(page.getByRole('heading',{name:'Good to see you again.'})).toBeVisible();
  await page.route('**/api/auth',route=>route.fulfill({json:{ok:true,redirect:'/account'}}));
  await page.getByLabel('Email address').fill('qa@example.com');await page.getByLabel('Password',{exact:true}).fill('qa-password');await page.getByRole('button',{name:/^Sign in/}).click();await expect(page).toHaveURL(/\/field\/e-edge-direct-2u$/);
  const field=await request.get('/field/e-edge-direct-2u');expect(field.headers()['permissions-policy']).toContain('geolocation=(self)');expect(field.headers()['cache-control']).toContain('no-store');
  const home=await request.get('/');expect(home.headers()['permissions-policy']).toContain('geolocation=()');
  const denied=await request.post('/api/platform',{headers:{origin:'http://127.0.0.1:3100'},data:{action:'activation',company_id:'10000000-0000-4000-8000-000000000001',active:false}});expect(denied.ok()).toBe(false);
});
