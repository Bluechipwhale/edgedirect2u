// Standard startup filename for managed Node hosts. This delegates to Next's
// generated standalone server; it does not create a custom Next.js server.
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const entry = join(__dirname, '.next', 'standalone', 'server.js');
if (!existsSync(entry)) throw new Error('Production build missing. Run the approved production build before starting this release.');
require(entry);
