import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
export function validSignature(body: string, signature: string, secret: string) { const expected = createHmac('sha512', secret).update(body).digest('hex'); return /^[a-f0-9]{128}$/i.test(signature) && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex')); }
export async function paystack(path: string, body?: unknown) {
  const secret = process.env.PAYSTACK_SECRET_KEY; if (!secret) throw new Error('Paystack is not configured. Add PAYSTACK_SECRET_KEY to enable payments.');
  const response = await fetch(`https://api.paystack.co${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const json = await response.json(); if (!response.ok || !json.status) throw new Error('Payment provider request failed. Please retry.'); return json.data;
}
export function verifiedCharge(data: { reference: string; amount: number; currency: string; status: string }, reference: string, amount: number) { if (data.reference !== reference || data.amount !== amount || data.currency !== 'NGN' || data.status !== 'success') throw new Error('Payment verification mismatch'); return data; }
