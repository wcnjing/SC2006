import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: [{ find: /^react-native$/, replacement: 'react-native-web' }] },
  esbuild: { jsx: 'automatic' },
  test: { include: ['test/**/*.test.tsx'], environment: 'jsdom' },
});
