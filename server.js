// Standard startup filename for managed Node hosts. This delegates to Next's
// generated standalone server; it does not create a custom Next.js server.
const { existsSync } = require('node:fs');
const { join, isAbsolute } = require('node:path');
const entry = join(__dirname, '.next', 'standalone', 'server.js');
if (!existsSync(entry)) throw new Error('Production build missing. Run the approved production build before starting this release.');
// Some managed hosts serialize panel environment values into a document-root
// .htaccess file. Keep privileged values in an owner-only file outside that root.
if (process.env.RUNTIME_ENV_FILE) {
  if (!isAbsolute(process.env.RUNTIME_ENV_FILE)) throw new Error('Private runtime configuration requires an absolute path.');
  try { process.loadEnvFile(process.env.RUNTIME_ENV_FILE); }
  catch { throw new Error('Private runtime configuration could not be loaded.'); }
}
require(entry);
