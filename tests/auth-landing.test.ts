import { it, expect } from 'vitest';
import { authLanding } from '../src/lib/auth-landing';

it('routes a root PKCE callback without treating normal browsing as recovery', () => {
  expect(authLanding('https://edgedirect2u.vercel.app/?code=qa-code')).toEqual({kind:'redirect',href:'/auth/confirm?code=qa-code'});
  for(const url of ['https://shop.example/','https://shop.example/products?code=coupon','https://shop.example/#ordinary-anchor'])expect(authLanding(url)).toBeNull();
});
it('recognizes implicit recovery tokens and rejects incomplete or expired links', () => {
  expect(authLanding('https://shop.example/#type=recovery&access_token=qa-access&refresh_token=qa-refresh')).toEqual({kind:'session',access_token:'qa-access',refresh_token:'qa-refresh'});
  for(const hash of ['#type=recovery&access_token=incomplete','#error_code=otp_expired'])expect(authLanding(`https://shop.example/${hash}`)).toEqual({kind:'redirect',href:'/forgot-password?expired=1'});
  expect(authLanding('https://shop.example/?token_hash=qa-hash&type=recovery')).toEqual({kind:'redirect',href:'/auth/confirm?token_hash=qa-hash&type=recovery'});
});
it('only forwards a legacy localhost link to the explicitly trusted live deployment', () => {
  const url='http://localhost:3000/?code=qa-code';
  expect(authLanding(url,'https://edgedirect2u.vercel.app')).toEqual({kind:'redirect',href:'https://edgedirect2u.vercel.app/?code=qa-code'});
  expect(authLanding(url,'https://edgedirect2u.com')).toEqual({kind:'redirect',href:'https://edgedirect2u.com/?code=qa-code'});
  for(const target of ['https://untrusted.example','http://edgedirect2u.vercel.app','https://edgedirect2u.com:8443','https://user@edgedirect2u.com'])expect(authLanding(url,target)).toEqual({kind:'redirect',href:'/auth/confirm?code=qa-code'});
  expect(authLanding('https://shop.example/?code=qa-code','https://edgedirect2u.vercel.app')).toEqual({kind:'redirect',href:'/auth/confirm?code=qa-code'});
});
