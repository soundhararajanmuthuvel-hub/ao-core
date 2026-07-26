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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React core — split first to keep it small and cacheable
            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('react/')) {
              return 'vendor-react';
            }
            // Lucide icons — large icon set, separate from react core
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Map library — lazy-loaded on pages that use it
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            // Charts — should only load on Reports/Dashboard pages
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            // PDF generation — should only load on Invoice/Report export pages
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            // Animations
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // Everything else from node_modules
            return 'vendor';
          }
        }
      }
    }
  }
};

