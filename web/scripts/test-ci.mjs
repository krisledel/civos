import { spawn } from 'node:child_process';
const server = spawn(
  process.execPath,
  ['node_modules/vinext/dist/cli.js', 'dev'],
  { stdio: 'inherit' },
);
const finish = () => server.kill('SIGTERM');
process.on('SIGINT', finish);
process.on('SIGTERM', finish);
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch('http://localhost:3000/api/civos');
      if (r.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw Error('Local server did not become ready');
  await import('./test.mjs');
} finally {
  finish();
}
