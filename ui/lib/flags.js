// Build flags for the Svelte pages: the values src/flags.js got when this copy of the
// extension was built (docs/FLAGS.md). Fixed for the build, never fetched. A flag
// that's off, or retired from the registry, reads false.
export const flag = (name) => globalThis.OH?.flags?.[name] === true;
