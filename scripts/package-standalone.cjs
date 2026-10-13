const {cpSync,mkdirSync,existsSync}=require('node:fs');
const {resolve}=require('node:path');
const output=resolve('.next/standalone');
if(!existsSync(resolve(output,'server.js')))throw new Error('Build standalone output first');
mkdirSync(resolve(output,'.next'),{recursive:true});
cpSync(resolve('public'),resolve(output,'public'),{recursive:true});
cpSync(resolve('.next/static'),resolve(output,'.next/static'),{recursive:true});
console.log('Standalone assets copied. Start .next/standalone/server.js with the host PORT.');
