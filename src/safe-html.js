/*
 * The one way markup reaches a page: setHTML(el, html). Text read from RSI
 * (pledge, item and ship names, descriptions) goes in as text (textContent, or
 * Svelte's {value}), never as HTML. Where a page truly needs markup, it comes here.
 * test/html-insertion.test.js fails a change that inserts HTML any other way
 * (innerHTML, insertAdjacentHTML, {@html}, …).
 *
 * It's an ALLOWLIST sanitizer (the same idea as DOMPurify): the HTML is parsed into
 * an inert document, and only the tags and attributes our pages actually use
 * survive. Links must be ordinary web/mailto/relative URLs, and style attributes
 * can't load anything (no url()). Anything else is dropped and logged as
 * "[setHTML] dropped …" (the UI smoke test fails on that log), so it backs up
 * OH.escapeHtml rather than replacing it. Table sections parse in table context so
 * <tr>/<td> survive, and markup for an <svg> parses as SVG.
 *
 * A classic script (no imports): src/dashboard.html loads it before dashboard.js,
 * and ui/lib/safe-html.js imports it for the Svelte pages' use:safeHTML. Both read
 * it from self.OHSafeHTML.
 */
(function () {
  'use strict';

  const htmlParser = new DOMParser();
  const TABLE_PARTS = new Set(['TBODY', 'THEAD', 'TFOOT']);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SAFE_TAGS = new Set(
    (
      'a abbr b br button caption code details div em figcaption figure h2 h3 h4 hr i img ' +
      'input label li ol option p pre section select small span strong sub summary sup ' +
      'table tbody td th thead time tr u ul ' +
      'svg g circle ellipse line path polygon polyline rect text tspan title defs lineargradient stop'
    ).split(' '),
  );
  const SAFE_ATTRS = new Set(
    (
      'alt checked class colspan datetime disabled draggable height hidden href id inputmode loading ' +
      'maxlength name placeholder rel role rowspan selected src style tabindex target title type ' +
      'value width srcset sizes ' +
      'cx cy d dominant-baseline fill fill-opacity font-size font-weight offset opacity points ' +
      'preserveaspectratio r rx ry stop-color stroke stroke-dasharray stroke-linecap ' +
      'stroke-linejoin stroke-opacity stroke-width text-anchor transform viewbox x x1 x2 xmlns y y1 y2'
    ).split(' '),
  );
  const SAFE_URL = /^(https?:|mailto:|#|\/|\.|[^:]*$)/i;

  function setHTML(el, html) {
    if (!el) return;
    if (html == null || html === '') {
      el.replaceChildren();
      return;
    }
    const tag = el.tagName;
    const t = tag.toLowerCase();
    const svg = el.namespaceURI === SVG_NS;
    let src = String(html);
    if (svg) src = `<svg>${src}</svg>`;
    else if (tag === 'TR') src = `<table><tbody><tr>${src}</tr></tbody></table>`;
    else if (TABLE_PARTS.has(tag)) src = `<table><${t}>${src}</${t}></table>`;
    else if (tag === 'TABLE') src = `<table>${src}</table>`;
    const body = htmlParser.parseFromString(src, 'text/html').body;
    const root = svg
      ? body.querySelector('svg')
      : tag === 'TR' || TABLE_PARTS.has(tag) || tag === 'TABLE'
        ? body.querySelector(t)
        : body;
    for (const node of [...root.querySelectorAll('*')]) {
      const name = node.tagName.toLowerCase();
      if (!SAFE_TAGS.has(name)) {
        console.warn(`[setHTML] dropped <${name}>`);
        node.remove();
        continue;
      }
      for (const a of [...node.attributes]) {
        const an = a.name.toLowerCase();
        const known = SAFE_ATTRS.has(an) || an.startsWith('data-') || an.startsWith('aria-');
        const badUrl =
          ((an === 'href' || an === 'src') && !SAFE_URL.test(a.value.trim())) ||
          (an === 'srcset' &&
            a.value.split(',').some((c) => !SAFE_URL.test(c.trim().split(/\s+/)[0] || '')));
        const badStyle = an === 'style' && /url\s*\(|expression|javascript:/i.test(a.value);
        if (!known || badUrl || badStyle) {
          console.warn(`[setHTML] dropped ${an}= on <${name}>`);
          node.removeAttribute(a.name);
        }
      }
    }
    el.replaceChildren(...root.childNodes);
  }

  self.OHSafeHTML = Object.freeze({ setHTML });
})();
