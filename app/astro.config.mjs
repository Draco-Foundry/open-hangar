// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  // Pages render per request on Cloudflare (sessions, D1).
  output: 'server',
  adapter: cloudflare(),
  integrations: [svelte()],
  // Reject cross-site form posts (sign-in, connect, disconnect).
  security: { checkOrigin: true },
});
