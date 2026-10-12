import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Serve public/assets at /assets so GLTFLoader paths work in dev and build
  publicDir: 'public',
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  plugins: [
    {
      name: 'admin-route-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url === '/admin' || req.url.startsWith('/admin/'))) {
            req.url = '/admin.html';
          }
          next();
        });
      }
    }
  ]
});
