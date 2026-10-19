import { execSync } from 'child_process';

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('[HushArc] Running code verification and type-checking...');

try {
  console.log('[1/2] Checking client TypeScript...');
  execSync(`${npxCmd} tsc --noEmit -p tsconfig.json`, { stdio: 'inherit' });

  console.log('[2/2] Checking server TypeScript...');
  execSync(`${npxCmd} tsc --noEmit -p tsconfig.server.json`, { stdio: 'inherit' });

  console.log('[HushArc] Code checks passed cleanly.');
} catch (err) {
  console.error('[HushArc] Code checks failed.');
  process.exit(1);
}
