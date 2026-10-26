// Builds dist-web/emberfall-online.html: the whole game as one self-contained page
// (scripts and CSS inlined, fonts from Google Fonts) for playing in a browser.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = p => readFileSync(path.join(root, 'src', p), 'utf8');
const html = src('index.html');
const css = src('style.css').replace(/@font-face\s*{[^}]*}\s*/g, '');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const body = html.match(/<body>([\s\S]*?)<script/)[1].trim();
const out = [
  '<title>Emberfall Online</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;700;800&display=swap">',
  `<style>\n${css}\n</style>`,
  body,
  ...scripts.map(s => `<script>\n${src(s).replace(/<\/script/gi, '<\\/script')}\n</script>`),
].join('\n');
mkdirSync(path.join(root, 'dist-web'), { recursive: true });
writeFileSync(path.join(root, 'dist-web', 'emberfall-online.html'), out);
console.log(`dist-web/emberfall-online.html (${Math.round(out.length / 1024)} KB)`);
