# fix/sitemap-store

## Goal

open-hangar#546: openhangar.space/sitemap.xml lists the Store (openhangar.space/store),
the address the website now names as the Store's canonical one.

## Steps

1. Add https://openhangar.space/store to site/sitemap.xml.
2. A test: every sitemap address is one openhangar.space serves (a file in site/ or a
   path the front Worker hands to the website), the Store among them.
3. `npm run format:check`, `npm test`. After merge, curl the live sitemap.

## Done

The live sitemap lists /store; checks green.
