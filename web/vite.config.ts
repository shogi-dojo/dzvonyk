import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Vendor packages grouped into stable, separately-cacheable chunks.
const VENDOR_CHUNKS: Record<string, string[]> = {
  react: ['react', 'react-dom', 'react-router-dom', 'dexie-react-hooks'],
  redux: ['@reduxjs/toolkit', 'react-redux'],
  i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
  db: ['dexie'],
  zip: ['jszip'],
  icons: ['lucide-react'],
  validation: ['zod'],
  firebase: ['firebase'],
};

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3000, // Set the development server port to 3000
    host: true, // Expose the server to be accessible on the network (e.g., on your local IP address)
  },
  preview: {
    port: 3001, // Optional: set a different port for the production preview server
  },
  plugins: [
    react(),
    VitePWA({
      // Terser hangs on Termux/Android when minifying the workbox SW template.
      // Set VITE_DISABLE_PWA=true to skip PWA entirely for deploy builds from Termux.
      disable: process.env.VITE_DISABLE_PWA === 'true',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Дзвоник — шкільний розклад',
        short_name: 'Дзвоник',
        description: 'Офлайн-планувальник шкільного розкладу для завуча. AGPL-3.0.',
        start_url: '/',
        scope: '/',
        id: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#f59e0b',
        background_color: '#faf8f5',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor code into stable, separately-cacheable chunks.
        //
        // Deliberately NOT route-level lazy loading: Дзвоник is offline-first
        // (see the brief on Ukrainian power cuts), and a завуч who loses
        // connectivity before first visiting a route would hit a chunk-load
        // failure on the page they need. Every chunk here is still precached
        // by Workbox up front, so offline behaviour is unchanged — this only
        // means an app update no longer invalidates the vendor code too.
        manualChunks(id) {
          if (id.includes('node_modules/@radix-ui/')) return 'radix';
          for (const [chunk, pkgs] of Object.entries(VENDOR_CHUNKS)) {
            if (pkgs.some((pkg) => id.includes(`node_modules/${pkg}/`))) return chunk;
          }
        },
      },
    },
  },
})
