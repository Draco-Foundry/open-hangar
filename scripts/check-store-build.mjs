// Store build guard: fails if dist/ carries anything a store package must not:
// a dev build's built-in sync site (npm run build:staging writes one into lib.js),
// the staging site's address, or the unlaunched sync code (an OH_SYNC=1 build). Release, publish and CI run it after packing.
//   node scripts/check-store-build.mjs [dir]   (default: dist)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = process.argv[2] || 'dist';
const BAD = [
  [/staging\.openhangar\.space/, 'the staging site'],
  [/SITE_BUILT_IN\s*=\s*(['"`])(?!\1)/, 'a built-in sync site (npm run build:staging)'],
  [/app\.openhangar\.space/, 'sync code (an OH_SYNC=1 build)'],
];
const problems = [];
const check = (name, text) => {
  for (const [re, what] of BAD) if (re.test(text)) problems.push(`${name}: ${what}`);
};

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs|html|json|css)$/.test(e.name)) check(p, readFileSync(p, 'utf8'));
    else if (e.name.endsWith('.zip')) {
      // The zips are what the stores get: read every text file inside them too.
      let list;
      try {
        list = execFileSync('unzip', ['-Z1', p], { encoding: 'utf8' }).split('\n');
      } catch {
        problems.push(`${p}: couldn't list the zip (is unzip installed?)`);
        continue;
      }
      for (const f of list.filter((f) => /\.(js|mjs|html|json|css)$/.test(f)))
        check(`${p}:${f}`, execFileSync('unzip', ['-p', p, f], { encoding: 'utf8' }));
    }
  }
}

if (!existsSync(root)) {
  console.error(`✖ ${root} doesn't exist: build first`);
  process.exit(1);
}
walk(root);
if (problems.length) {
  console.error(`✖ Not a store build:\n  ${problems.join('\n  ')}`);
  console.error('Rebuild with npm run build (or npm run pack) before releasing.');
  process.exit(1);
}
console.log(`✔ ${root} is a clean store build (no staging site, no sync code)`);
