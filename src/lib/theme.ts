import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color');
const safeLink = z.string().max(500).refine(v => !v || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v), 'Use a relative path or HTTPS URL');
export const themeSchema = z.object({
  name: z.string().min(2).max(60), tagline: z.string().max(120), description: z.string().max(500),
  email: z.union([z.literal(''), z.email()]), phone: z.string().max(40), copyright: z.string().max(150),
  logo: safeLink, lightLogo: safeLink, darkLogo: safeLink, mobileLogo: safeLink, favicon: safeLink,
  instagram: safeLink, facebook: safeLink,
  primary: color, secondary: color, accent: color, background: color, surface: color,
  text: color, muted: color, border: color, success: color, warning: color, error: color,
  headingFont: z.enum(['Geist', 'Georgia', 'Arial']), bodyFont: z.enum(['Geist', 'Arial', 'Verdana']),
  fontSize: z.number().min(14).max(20), scale: z.number().min(1).max(1.4),
  radius: z.number().min(0).max(28), shadow: z.enum(['none', 'soft', 'strong']),
  width: z.number().min(960).max(1600), density: z.enum(['compact', 'comfortable', 'spacious']),
  headerHeight: z.number().min(64).max(120), sticky: z.boolean(), buttonStyle: z.enum(['solid', 'outline']),
  buttonSize: z.enum(['small', 'medium', 'large']), productLayout: z.enum(['four', 'five']),
  announcement: z.string().max(200), announcementEnabled: z.boolean(), announcementLink: safeLink,
  announcementBackground: color, announcementText: color,
  heroEyebrow: z.string().max(80), heroTitle: z.string().min(1).max(150), heroText: z.string().max(400),
  heroCta: z.string().max(50), heroLink: safeLink, heroSecondary: z.string().max(50), heroSecondaryLink: safeLink,
  heroImage: safeLink, heroMobileImage: safeLink, heroAlign: z.enum(['left', 'center']), heroHeight: z.number().min(360).max(700),
  heroOverlay: z.number().min(0).max(0.8), heroBackground: color,
  seoTitle: z.string().max(100), seoDescription: z.string().max(300),
  footerLinks: z.array(z.object({ label: z.string().min(1).max(50), href: safeLink })).max(20),
  navigation: z.array(z.object({ label: z.string().min(1).max(50), href: safeLink })).max(12),
  sections: z.array(z.enum(['categories', 'featured', 'banners', 'new', 'merchants'])).max(5),
});
export type Theme = z.infer<typeof themeSchema>;
export const defaultTheme: Theme = {
  name: 'edgedirect2u', tagline: 'Good finds. Great living.', description: 'Your everyday essentials and next favourite finds, all in one place.',
  email: '', phone: '', copyright: '© 2026 Edgedirect2u. All rights reserved.', logo: '', lightLogo: '', darkLogo: '', mobileLogo: '', favicon: '', instagram: '', facebook: '',
  primary: '#6C3BFF', secondary: '#15152B', accent: '#C8F169', background: '#F8F8FC', surface: '#FFFFFF', text: '#181824', muted: '#717184', border: '#E8E8F0', success: '#168A54', warning: '#E7A526', error: '#D64545',
  headingFont: 'Geist', bodyFont: 'Geist', fontSize: 16, scale: 1.15, radius: 14, shadow: 'soft', width: 1360, density: 'comfortable', headerHeight: 88, sticky: true, buttonStyle: 'solid', buttonSize: 'medium', productLayout: 'four',
  announcement: 'Good finds, delivered to your doorstep. Discover your next favourite.', announcementEnabled: true, announcementLink: '/products', announcementBackground: '#15152B', announcementText: '#FFFFFF',
  heroEyebrow: 'A LITTLE DISCOVERY. A LOT TO LOVE.', heroTitle: 'Your everyday.\nWith an edge.', heroText: 'From the things you need to the finds you didn’t know you loved. Discover a better way to shop, all in one place.', heroCta: 'Explore the collection', heroLink: '/products', heroSecondary: 'Meet our merchants', heroSecondaryLink: '/merchants', heroImage: '', heroMobileImage: '', heroAlign: 'left', heroHeight: 490, heroOverlay: 0, heroBackground: '#EFEAFD',
  seoTitle: 'Edgedirect2u — Good finds. Great living.', seoDescription: 'Discover electronics, fashion, home essentials and more at Edgedirect2u.',
  navigation: [{ label: 'New arrivals', href: '/products?sort=newest' }, { label: 'Electronics', href: '/categories/electronics' }, { label: 'Fashion', href: '/categories/fashion' }, { label: 'Home & living', href: '/categories/home' }, { label: 'Beauty', href: '/categories/beauty' }, { label: 'Shop local', href: '/merchants' }],
  footerLinks: [{ label: 'Help centre', href: '/help' }, { label: 'Delivery information', href: '/help/delivery' }, { label: 'Returns & refunds', href: '/help/returns' }, { label: 'Privacy policy', href: '/help/privacy' }, { label: 'Terms of service', href: '/help/terms' }],
  sections: ['categories', 'featured', 'banners', 'new', 'merchants'],
};
export const presets: Record<string, Partial<Theme>> = {
  'Electric Modern': { primary: '#6C3BFF', secondary: '#15152B', accent: '#C8F169', background: '#F8F8FC', heroBackground: '#EFEAFD', radius: 14, headingFont: 'Geist' },
  'Luxury Minimal': { primary: '#302B25', secondary: '#181818', accent: '#D5C4A1', background: '#FAF8F3', heroBackground: '#ECE7DC', radius: 2, headingFont: 'Georgia' },
  'Vibrant Gen Z': { primary: '#C62D6E', secondary: '#252044', accent: '#C8F169', background: '#FFF7FA', heroBackground: '#FFE5F0', radius: 24, headingFont: 'Geist' },
  'Clean Marketplace': { primary: '#006758', secondary: '#12382F', accent: '#C9EEDB', background: '#F5FAF7', heroBackground: '#E3F1EA', radius: 8, headingFont: 'Arial' },
  'Corporate Premium': { primary: '#2457C5', secondary: '#142747', accent: '#DCE5F8', background: '#F6F8FC', heroBackground: '#E5ECF8', radius: 6, headingFont: 'Geist' },
};
export function themeTokens(t: Theme): Record<string, string | number> {
  return { '--brand-primary': t.primary, '--brand-secondary': t.secondary, '--brand-accent': t.accent, '--page-background': t.background, '--surface-color': t.surface, '--text-color': t.text, '--muted-color': t.muted, '--border-color': t.border, '--success': t.success, '--warning': t.warning, '--error': t.error, '--radius': `${t.radius}px`, '--font-body': `${t.bodyFont}, Arial, sans-serif`, '--font-heading': `${t.headingFont}, Arial, sans-serif`, '--base-size': `${t.fontSize}px`, '--type-scale': t.scale, '--page-width': `${t.width}px`, '--header-height': `${t.headerHeight}px`, '--spacing': t.density === 'compact' ? '24px' : t.density === 'spacious' ? '64px' : '44px', '--card-shadow': t.shadow === 'none' ? 'none' : t.shadow === 'strong' ? '0 12px 35px #15152b16' : '0 4px 18px #15152b06', '--button-height': t.buttonSize === 'small' ? '36px' : t.buttonSize === 'large' ? '52px' : '44px', '--hero-background': t.heroBackground };
}
export function contrast(a: string, b: string) {
  const lum = (hex: string) => { const rgb = hex.match(/[a-f\d]{2}/gi)!.map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
  const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function assertPublishable(t:Theme){if(contrast(t.text,t.background)<4.5||contrast(t.primary,'#FFFFFF')<4.5)throw new Error('Improve text and button contrast to at least 4.5:1 before publishing');}
