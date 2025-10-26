import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Disable JSX runtime transformation to avoid issues
      jsxRuntime: 'classic'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: [
      '6d8a2fd655b0.ngrok-free.app',
      'a411ba3c0c65.ngrok-free.app',
      '3789c6bc9268.ngrok-free.app'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-avatar']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react-router-dom', '@tanstack/react-query', 'react-hook-form']
  },
  // Disable TypeScript checking by using tsx as jsx
  esbuild: {
    // Drop console logs in production
    drop: ['console', 'debugger']
  }
});