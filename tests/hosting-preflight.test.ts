import { describe, expect, it } from 'vitest';
import { configurationProblems, buildFileProblems } from '../scripts/hosting-preflight.cjs';

const buildEnv = {
  NODE_ENV: 'production', LOCAL_DEMO: 'false',
  DEPLOYMENT_APP_ORIGIN: 'https://staging.example.com',
  NEXT_PUBLIC_SITE_URL: 'https://staging.example.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://exampleproject.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_example',
};

describe('hosting deployment safety', () => {
  it('accepts explicit build settings without requiring privileged build keys', () => {
    expect(configurationProblems(buildEnv, '24.11.0', 'build')).toEqual([]);
  });
  it('blocks a runtime downgrade or a Node release missing the existing CLI flag', () => {
    for (const version of ['12.9.0', '20.19.0', '22.19.0', '24.0.0', '25.0.0']) {
      expect(configurationProblems(buildEnv, version, 'build')).not.toHaveLength(0);
    }
  });
  it('blocks old canonical URLs and proxy or local origins', () => {
    for (const origin of ['http://staging.example.com', 'https://0.0.0.0:3000', 'https://localhost', 'https://192.168.1.1', 'https://[::1]', ' https://example.com', 'https://user:private@example.com', 'https://example.com/path', 'https://example.com?token=private']) {
      expect(configurationProblems({ ...buildEnv, DEPLOYMENT_APP_ORIGIN: origin, NEXT_PUBLIC_SITE_URL: origin }, '24.11.0')).not.toHaveLength(0);
    }
    expect(configurationProblems({ ...buildEnv, NEXT_PUBLIC_SITE_URL: 'https://previous.example.com' }, '24.11.0')).not.toHaveLength(0);
  });
  it('rejects privileged Supabase keys in public settings', () => {
    const jwt = 'header.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.signature';
    expect(configurationProblems({ ...buildEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt }, '24.11.0')).not.toHaveLength(0);
    expect(configurationProblems({ ...buildEnv, NEXT_PUBLIC_PAYSTACK_SECRET_KEY: 'private-sentinel' }, '24.11.0').join(' ')).not.toContain('private-sentinel');
    expect(configurationProblems({ ...buildEnv, NEXT_PUBLIC_PAYSTACK_SECRET_KEY: 'private-sentinel' }, '24.11.0')).not.toHaveLength(0);
  });
  it('requires server services for runtime but never prints their values', () => {
    expect(configurationProblems(buildEnv, '24.11.0', 'runtime')).not.toHaveLength(0);
    const errors = configurationProblems({ ...buildEnv, SUPABASE_SERVICE_ROLE_KEY: 'private-service-sentinel', PAYSTACK_SECRET_KEY: 'private-payment-sentinel' }, '24.11.0', 'runtime');
    expect(errors.join(' ')).not.toContain('private-service-sentinel');
    expect(errors.join(' ')).not.toContain('private-payment-sentinel');
    expect(configurationProblems({ ...buildEnv, SUPABASE_SERVICE_ROLE_KEY: 'private-service-sentinel', PAYSTACK_SECRET_KEY: 'sk_test_' + 'a'.repeat(40), PORT: '3100' }, '24.11.0', 'runtime')).toEqual([]);
  });
  it('blocks dotenv files carrying secrets into build traces', () => {
    expect(buildFileProblems({ '.env.local': 'PAYSTACK_SECRET_KEY=private-sentinel' })).not.toHaveLength(0);
    expect(buildFileProblems({ '.env.production': 'PAYSTACK_SECRET_KEY=private-sentinel' }).join(' ')).not.toContain('private-sentinel');
    expect(buildFileProblems({ '.env.production': 'PAYSTACK_SECRET_KEY=private-sentinel' })).not.toHaveLength(0);
    expect(buildFileProblems({ '.env.production': 'NEXT_PUBLIC_SUPABASE_ANON_KEY=sk_live_private-sentinel' })).not.toHaveLength(0);
    expect(buildFileProblems({ '.env.example': '', '.env.production': 'NEXT_PUBLIC_SITE_URL=https://staging.example.com\nLOCAL_DEMO=false\n' })).toEqual([]);
  });
});
