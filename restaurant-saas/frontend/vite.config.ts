import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 3000,
    // No proxy needed — frontend calls XAMPP backend directly via VITE_API_URL
    // CORS is handled in PHP's index.php
    cors: true,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom', 'react-router-dom'],
          gsap:     ['gsap'],
          charts:   ['recharts'],
          query:    ['@tanstack/react-query'],
          ui:       ['lucide-react', 'react-hot-toast'],
        },
      },
    },
  },
});
