// Builds the Svelte pages (ui/) into src/ui/, next to the classic dashboard
// scripts, so every existing way of loading the extension (dist/ via pack.mjs,
// the demo server, the smoke tests) picks them up unchanged.
//
// Output is not minified: store reviewers (Firefox's especially) read it, and the
// readable build is what ships. src/ui/ is generated; don't edit or commit it.
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Relative asset URLs: extension pages load from chrome-extension://<id>/src/.
  base: './',
  build: {
    outDir: 'src/ui',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    // Fonts ship as files next to the bundle, never inlined or fetched remotely.
    assetsInlineLimit: 0,
    modulePreload: false,
    rollupOptions: {
      input: 'ui/home/main.js',
      output: {
        format: 'es',
        entryFileNames: 'home.js',
        assetFileNames: (a) =>
          (a.names || [a.name || '']).some((n) => /\.css$/.test(n))
            ? 'home.css'
            : 'fonts/[name][extname]',
      },
    },
  },
});
