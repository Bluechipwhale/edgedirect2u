// Deployment checks only. This does not load private dotenv files or contact providers.
const fs = require('node:fs');
const { isIP } = require('node:net');
const publicNames = ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

function secureOrigin(value) {
  try {
    if (typeof value !== 'string' || /\s/.test(value)) return false;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      url.pathname === '/' && !url.search && !url.hash &&
      !isIP(url.hostname.replace(/^\[|\]$/g, '')) &&
      url.hostname !== 'localhost' && !url.hostname.endsWith('.localhost');
  } catch { return false; }
}

function publishableKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  try { return key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { return false; }
}

function configurationProblems(env, nodeVersion = process.versions.node, mode = 'build') {
  const errors = [];
  const [major, minor] = nodeVersion.split('.').map(Number);
  if (major !== 24 || minor < 6) errors.push('Use a maintained Node.js 24 release with --use-system-ca support (24.6 or later).');
  if (!['build', 'runtime'].includes(mode)) errors.push('Mode must be build or runtime.');
  if (env.NODE_ENV !== 'production') errors.push('NODE_ENV must be production.');
  if (env.LOCAL_DEMO !== 'false') errors.push('LOCAL_DEMO must be false.');
  if (!secureOrigin(env.DEPLOYMENT_APP_ORIGIN)) errors.push('DEPLOYMENT_APP_ORIGIN must be the verified public HTTPS staging or production origin.');
  if (!secureOrigin(env.NEXT_PUBLIC_SITE_URL) || env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') !== env.DEPLOYMENT_APP_ORIGIN?.replace(/\/$/, '')) errors.push('NEXT_PUBLIC_SITE_URL must match DEPLOYMENT_APP_ORIGIN.');
  if (!secureOrigin(env.NEXT_PUBLIC_SUPABASE_URL) || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(env.NEXT_PUBLIC_SUPABASE_URL || '')) errors.push('NEXT_PUBLIC_SUPABASE_URL must identify the intended hosted Supabase project.');
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!publishableKey(key)) errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY must be a publishable key or an anon-role JWT.');
  if (Object.keys(env).some(name => name.startsWith('NEXT_PUBLIC_') && !publicNames.includes(name))) errors.push('Unexpected NEXT_PUBLIC_ variable: review browser exposure before building.');
  if (env.NEXT_DIST_DIR && env.NEXT_DIST_DIR !== '.next') errors.push('The standalone asset packager requires the default .next build directory.');
  if (mode === 'runtime') {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) errors.push('SUPABASE_SERVICE_ROLE_KEY is required on the server.');
    if (!/^sk_(test|live)_[a-f0-9]{40}$/.test(env.PAYSTACK_SECRET_KEY || '')) errors.push('PAYSTACK_SECRET_KEY is missing or has an unexpected format.');
    if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) errors.push('PORT must be a valid assigned TCP port; Passenger socket compatibility requires separate verification.');
  }
  return errors;
}

function buildFileProblems(files) {
  const errors = [];
  for (const [name, content] of Object.entries(files)) {
    if (name === '.env.example') continue;
    if (name !== '.env.production') {
      errors.push('Use a clean checkout without local or private dotenv files for the build.');
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const separator = line.indexOf('=');
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1).replace(/^(['"])(.*)\1$/, '$2');
      const valid = key === 'LOCAL_DEMO' ? value === 'false' :
        key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ? publishableKey(value) :
        publicNames.includes(key) && secureOrigin(value);
      if (separator < 1 || !valid) errors.push('.env.production must contain valid public build settings only.');
    }
  }
  return errors;
}

module.exports = { configurationProblems, buildFileProblems };
if (require.main === module) {
  const mode = process.argv[2] || 'build';
  const errors = configurationProblems(process.env, process.versions.node, mode);
  if (mode === 'build') {
    const files = Object.fromEntries(fs.readdirSync('.').filter(name => name === '.env' || name.startsWith('.env.')).map(name => [name, name === '.env.production' ? fs.readFileSync(name, 'utf8') : '']));
    errors.push(...buildFileProblems(files));
  }
  for (const error of new Set(errors)) console.error('BLOCKED: ' + error);
  if (errors.length) process.exitCode = 1;
  else console.log('PASS configuration checks. Provider runner, Linux build, HTTPS, restart and end-to-end tests still require verification.');
}
