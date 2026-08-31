import { defineConfig } from 'vite';

export default defineConfig({
  // Serve public/assets at /assets so GLTFLoader paths work in dev and build
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true,
  },
});
