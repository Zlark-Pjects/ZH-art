import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

/* The standalone game: one bundle, no public/ assets, inlined into a single HTML file by
   scripts/inline-stickville.mjs so it can be opened, hosted or shared on its own. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {alias: {'@': path.resolve(__dirname, '.')}},
  publicDir: false,
  build: {
    outDir: 'dist-stickville',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'stickville.html'),
      output: {inlineDynamicImports: true},
    },
  },
});
