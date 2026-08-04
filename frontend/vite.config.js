import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Project-page GitHub Pages deploys serve from /hms-application/, not the domain root.
  base: command === 'build' ? '/hms-application/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
}));
