// Starts the web app on the built-in mock backend (no Supabase keys needed).
// Demo accounts: see src/services/mock. Cross-platform replacement for
// `EXPO_PUBLIC_BACKEND=mock expo start --web`.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../../node_modules/expo/bin/cli', import.meta.url));
const child = spawn(process.execPath, [cli, 'start', '--web', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_BACKEND: 'mock' },
});
child.on('exit', (code) => process.exit(code ?? 0));
