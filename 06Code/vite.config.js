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
    port: Number(process.env.FRONTEND_PORT || 5175),
    proxy: {
      '/api/v1': process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3005',
    },
  },
});
