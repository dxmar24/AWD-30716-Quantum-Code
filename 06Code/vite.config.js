const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  root: 'frontend',
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': 'http://127.0.0.1:3000',
    },
  },
});
