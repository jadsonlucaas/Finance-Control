import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsDir: 'assets',
    rollupOptions: {
      external: (id) => id.startsWith('https://'),
      input: {
        app: 'index.html'
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (
            normalizedId.includes('/src/application/resilience/') ||
            normalizedId.includes('/src/services/connectivity/') ||
            normalizedId.includes('/src/ui/resilience/')
          ) {
            return 'app-resilience';
          }
          if (normalizedId.includes('node_modules/chart.js')) return 'vendor-chart';
          if (normalizedId.includes('node_modules/lucide')) return 'vendor-icons';
          if (
            normalizedId.includes('node_modules/@firebase/firestore') ||
            normalizedId.includes('node_modules/firebase/firestore')
          ) {
            return 'services-firestore';
          }
          if (normalizedId.includes('node_modules/firebase')) {
            return 'services-firebase';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  }
});
