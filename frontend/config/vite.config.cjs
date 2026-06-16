const path = require('path');

module.exports = {
  root: path.resolve(__dirname, '..'),
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
};
