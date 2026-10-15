export function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured && process.env.NODE_ENV !== 'production') return new URL(request.url).origin;
  const site = new URL(configured || '');
  if (!['http:', 'https:'].includes(site.protocol) || process.env.NODE_ENV === 'production' && site.protocol !== 'https:' || site.username || site.password) throw new Error('A public HTTPS site URL is required');
  return site.origin;
}
