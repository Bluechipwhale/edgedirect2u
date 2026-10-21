import { test,expect } from '@playwright/test';
test('catalogue search and pagination recover from repeated or invalid URL values',async({page,request})=>{
 await page.goto('/products?q=headphones&q=other');await expect(page.getByRole('heading',{name:'Results for “headphones”'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Studio wireless headphones'})).toBeVisible();
 await page.goto('/products?min=Infinity&page=Infinity');await expect(page.getByRole('heading',{name:'Shop the collection.'})).toBeVisible();
 await expect(page.getByText('Page 1 of 1',{exact:true})).toBeVisible();
 const empty=await request.get('/api/catalogue?page=10000');expect(empty.ok()).toBe(true);const data=await empty.json();expect(data.products).toEqual([]);expect(data.count).toBeGreaterThan(0);
});
test('driver sign-in preserves the driver entry destination',async({page})=>{
 await page.goto('/driver');await page.getByRole('link',{name:'Driver sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/login\?/);expect(new URL(page.url()).searchParams.get('next')).toBe('/driver');
 await page.route('**/api/auth',route=>route.fulfill({json:{ok:true,redirect:'/staff'}}));
 await page.getByLabel('Email address',{exact:true}).fill('driver@example.com');
 await page.getByLabel('Password',{exact:true}).fill('Example-driver-password');
 await page.getByRole('button',{name:'Sign in',exact:false}).click();await expect(page).toHaveURL(/\/driver$/);
});
test('password visibility toggles preserve the entered value without submitting the form',async({page})=>{
 for(const path of ['/login','/register']){
  await page.goto(path);const password=page.getByLabel('Password',{exact:true});
  await password.fill('Example-only-Password7');await expect(password).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'Show password',exact:true}).click();
  await expect(password).toHaveAttribute('type','text');await expect(password).toHaveValue('Example-only-Password7');
  await page.getByRole('button',{name:'Hide password',exact:true}).click();await expect(password).toHaveAttribute('type','password');
  await expect(page).toHaveURL(new RegExp(path+'$'));
 }
});
test('password recovery, expired links and reset session guard',async({page})=>{
  await page.goto('/login');await page.getByRole('link',{name:'Forgot password?'}).click();await expect(page.getByRole('heading',{name:'Let’s get you back in.'})).toBeVisible();
  await page.getByLabel('Email address').fill('qa@example.com');await page.getByRole('button',{name:'Send recovery link'}).click();await expect(page.getByRole('alert').filter({hasText:'Connect Supabase'})).toContainText('Connect Supabase');
  await page.goto('/auth/confirm?token_hash=invalid&type=recovery&next=https://untrusted.example');await expect(page).toHaveURL(/forgot-password\?expired=1/);await expect(page.getByText('This email link has expired or already been used. Request a new one below.')).toBeVisible();
  await page.goto('/reset-password');await expect(page.getByRole('heading',{name:'Request a secure link.'})).toBeVisible();
});
test('homepage recovery credentials reach the reset flow and expired fragments leave no tokens in the URL',async({page})=>{
  let consumed=false;
  await page.route('**/api/auth',async route=>{
    const body=route.request().postDataJSON();
    expect(body.action).toBe('recovery-session');
    expect(new URL(page.url()).hash).toBe('');
    consumed=true;await route.fulfill({status:400,json:{error:'Recovery link is invalid or expired'}});
  });
  await page.goto('/#type=recovery&access_token=qa-access-token-value&refresh_token=qa-refresh-token-value');
  await expect(page).toHaveURL(/\/forgot-password\?expired=1$/);expect(consumed).toBe(true);
  await page.goto('/?code=qa-expired-code');await expect(page).toHaveURL(/\/forgot-password\?expired=1$/);
});
test('email verification needs an explicit click and clears the token from browser history',async({page})=>{
  await page.goto('/auth/verify?token_hash=qa-single-use-email-token-hash&type=recovery');
  await expect(page.getByRole('heading',{name:'Let’s reset your password.'})).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/verify$/);
  await expect(page.getByRole('button',{name:'Continue securely',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue securely',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'expired or already been used'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Request a new link',exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue securely',exact:true})).toBeEnabled();
});
test('email verification submits a same-origin request without a referrer',async({page})=>{
  await page.route('**/auth/confirm',async route=>{
    const request=route.request();
    expect(request.method()).toBe('POST');expect(request.headers().origin).toBe('http://127.0.0.1:3100');expect(request.headers().referer).toBeUndefined();
    expect(new URLSearchParams(request.postData()!).get('type')).toBe('recovery');
    await route.fulfill({json:{ok:true,redirect:'/reset-password?verified=1'}});
  });
  await page.goto('/auth/verify?token_hash=qa-single-use-email-token-hash&type=recovery');
  await expect(page).toHaveURL(/\/auth\/verify$/);
  await page.getByRole('button',{name:'Continue securely',exact:true}).click();
  await expect(page).toHaveURL(/\/reset-password\?verified=1$/);
});
test('checkout sign-in preserves the bag and registration destination',async({page})=>{
  await page.goto('/products/sculpture-table-lamp');await page.getByRole('button',{name:'Add to bag',exact:true}).click();
  await page.goto('/login?next=/checkout');await expect(page.getByText('Your bag is saved. Sign in or create an account to continue to checkout.')).toBeVisible();
  await page.getByRole('link',{name:'Create an account',exact:true}).click();
  await expect(page).toHaveURL(/\/register\?next=%2Fcheckout$/);
  await page.getByRole('link',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
  await expect(page.getByRole('heading',{name:'Good to see you again.'})).toBeVisible();
  await page.route('**/api/auth',route=>route.fulfill({json:{ok:true,redirect:'/account'}}));
  await page.getByLabel('Email address').fill('qa@example.com');await page.getByLabel('Password',{exact:true}).fill('qa-password');
  await page.getByRole('button',{name:/^Sign in/}).click();await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText('1 × Sculpture table lamp')).toBeVisible();
});
test('saved addresses autofill checkout and a second tab follows bag changes',async({page,context,request})=>{
  const origin='http://127.0.0.1:3100';const address={name:'Saved QA Customer',phone:'08012345678',street:'123 Saved Address Street',city:'Abeokuta',state:'Ogun'};
  const res=await request.post('/api/manage',{headers:{origin},data:{kind:'addresses',id:'qa-autofill-address',data:address}});expect(res.ok()).toBe(true);
  await page.goto('/products/sculpture-table-lamp');await page.getByRole('button',{name:'Add to bag',exact:true}).click();
  const other=await context.newPage();await other.goto('/cart');await expect(other.getByRole('link',{name:'Shopping bag, 1 items'})).toBeVisible();
  await page.goto('/checkout');await page.getByLabel('Choose a saved address').selectOption('qa-autofill-address');
  await expect(page.getByLabel('Full name')).toHaveValue(address.name);await expect(page.getByLabel('Street address')).toHaveValue(address.street);await expect(page.getByLabel('State',{exact:true})).toHaveValue('Ogun');
  await page.getByLabel('Choose a saved address').selectOption('');await expect(page.getByLabel('Full name')).toHaveValue('');
  await other.getByRole('button',{name:'Remove Sculpture table lamp'}).click();await expect(page.getByRole('heading',{name:'A bag full of possibilities.'})).toBeVisible();await other.close();
});
test('CSP uses a fresh nonce and blocks inline injected scripts',async({page,request})=>{
  const a=await request.get('/'),b=await request.get('/');
  const csp=a.headers()['content-security-policy'];expect(csp).toContain("object-src 'none'");expect(csp).toContain("frame-ancestors 'self'");expect(csp).not.toBe(b.headers()['content-security-policy']);
  await page.route('http://127.0.0.1:3100/',async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);const body=(await response.text()).replace('<head>','<head><script>window.injected=true</script>');await route.fulfill({response,body});});
  await page.goto('/');
  expect(await page.evaluate(()=>Boolean((window as unknown as {injected?:boolean}).injected))).toBe(false);
});
test('small screens keep catalogue, checkout and recovery within viewport',async({page})=>{
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:900});
    for(const path of ['/','/products','/forgot-password']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${path} at ${width}px`).toBe(true);}
  }
});
