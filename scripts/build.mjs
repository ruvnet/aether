// Inlines src/styles.css and src/app.js into src/index.html and writes the single-file
// build to ./index.html (the file GitHub Pages serves). No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');

// Tolerant of formatting (self-closing "/>", extra spaces) so Prettier can't break the build.
const CSS_TAG = /<link\s+rel="stylesheet"\s+href="styles\.css"\s*\/?>/;
const JS_TAG = /<script\s+src="app\.js"\s*><\/script>/;

let html = read('src/index.html');
for (const tag of [CSS_TAG, JS_TAG]) {
  if (!tag.test(html)) throw new Error(`src/index.html is missing a match for ${tag}`);
}
// Function replacers: the CSS/JS contain "$" sequences that String.replace would treat specially.
html = html
  .replace(CSS_TAG, () => `<style>\n${read('src/styles.css')}\n</style>`)
  .replace(JS_TAG, () => `<script>\n${read('src/app.js')}\n</script>`);

writeFileSync(join(root, 'index.html'), html + '\n');
console.log(`Built index.html (${(html.length / 1024).toFixed(1)} KB)`);
