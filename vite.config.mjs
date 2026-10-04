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
    // One bundle per page (0.3.0 rebuild): ui/<page>/main.js → src/ui/<page>.js and
    // <page>.css. Add a page here as it moves from dashboard.js to Svelte.
    rollupOptions: {
      input: {
        home: 'ui/home/main.js',
        referrals: 'ui/referrals/main.js',
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        // Code two pages share (Svelte's runtime, ui/lib) goes in one shared file.
        chunkFileNames: '[name].js',
        assetFileNames: (a) =>
          (a.names || [a.name || '']).some((n) => /\.css$/.test(n))
            ? '[name][extname]'
            : 'fonts/[name][extname]',
      },
    },
  },
});
