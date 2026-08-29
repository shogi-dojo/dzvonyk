import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Дзвоник — шкільний розклад',
        short_name: 'Дзвоник',
        description: 'Офлайн-планувальник шкільного розкладу для завуча. AGPL-3.0.',
        theme_color: '#f59e0b',
        background_color: '#faf8f5',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
