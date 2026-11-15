import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Uploaded to GitHub Pages by .github/workflows/pages.yml (CNAME is copied from /public)
    outDir: 'docs',
    emptyOutDir: true,
    // ECharts alone is ~570 kB; it is lazy-loaded with the chart
    chunkSizeWarningLimit: 600,
  },
})
