# Fallback Page: Tagline and Phone Layout

Branch `fix/fallback-page-phone`. The static home page `site/index.html` (served when
the website Worker fails, and at openhangar.space/index.html). Goes live on merge.

## Goal

1. The title, the tagline under the h1, and the meta and og descriptions lead with
   "The free Star Citizen fleet manager." and describe it accurately: the extension
   reads your own RSI account in your browser, sync with openhangar.space is optional,
   and it's free.
2. No sideways scroll on phones: the hero text never runs past the right edge at
   360 to 430px.
3. The Open Beta card doesn't cover page content on phones, and still switches itself
   off after the release as it does today.

## Steps

1. Measure the page in headless Chrome at 320, 360, 375, 390, 414 and 430px: document
   width against the viewport, and any element past the right edge.
2. Fix any real overflow found.
3. New title, tagline and descriptions.
4. Beta card on phones: in the page flow instead of fixed over it; desktop unchanged.
5. Re-measure, screenshots at 360, 390, 430 and desktop.

## Done When

- `npm run format:check` and `npm test` pass.
- At 320 to 430px: `scrollWidth` equals the viewport width, no element past the right
  edge, the beta card covers nothing.
- The card still hides after the release date and stays closed once closed.
- No em dashes; Title Case headings and labels.
