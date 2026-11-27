import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('bostonLongwoodCatchment.json')) return 'catchment-data';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor-react';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  },
  test: {
    testTimeout: 15000
  }
});
