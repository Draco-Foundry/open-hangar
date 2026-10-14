# fix-site-store-links

Goal: close CodeQL alert #21 (DOM text reinterpreted as HTML, site/main.js) by building the
install buttons' links from constants in main.js instead of the page's data-url attributes.

Steps: move the three store URLs into STORE_URLS in site/main.js keyed by data-browser; drop
data-url from site/index.html and update its comment; check the buttons still get their links.

Done when: format:check and npm test pass; the three buttons link to their store pages.
