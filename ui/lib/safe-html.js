// use:safeHTML={markup}: the Svelte pages' way to put markup in an element, through
// the shared sanitizer (src/safe-html.js) instead of {@html}. Only for our own markup
// (the SVG icons); text read from RSI goes in as {text}.
import '../../src/safe-html.js';

export function safeHTML(node, html) {
  const { setHTML } = self.OHSafeHTML;
  setHTML(node, html);
  return { update: (next) => setHTML(node, next) };
}
