import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    // cannon-es is only reached through the simulation worker (packages/sim),
    // which the dependency scanner does not follow. Without this, the dev server
    // finds it at run time, re-optimizes and reloads the page on a cold cache.
    include: ['@billiards/sim > cannon-es']
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        }
      }
    }
  }
});
