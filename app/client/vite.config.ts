import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow connections from other devices
    allowedHosts: [
      '6d8a2fd655b0.ngrok-free.app',
      'a411ba3c0c65.ngrok-free.app',
      '3789c6bc9268.ngrok-free.app'  // Added your ngrok host
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
}); 