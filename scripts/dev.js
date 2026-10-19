import { spawn } from 'child_process';

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('[HushArc] Starting development environment...');

const serverProc = spawn(npxCmd, ['tsx', 'watch', 'server/server.ts'], {
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
    PORT: process.env.PORT || '10000',
    NODE_ENV: 'development',
  },
});

const clientProc = spawn(npxCmd, ['vite'], {
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
  },
});

function cleanup() {
  console.log('\n[HushArc] Shutting down development processes...');
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
