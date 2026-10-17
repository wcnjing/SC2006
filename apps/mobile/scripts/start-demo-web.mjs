import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve('expo/bin/cli'), 'start', '--web', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_DEMO_MODE: 'true' },
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
