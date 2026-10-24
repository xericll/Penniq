// Packs the Vite build into ONE self-contained page fragment (publish/penniq.html)
// for hosts that wrap the page themselves, e.g. a Claude artifact:
//   npm run pack      (runs `vite build --base=./` first)
// CSS and JS are inlined, the main font subsets become data: URIs, and there is
// no <html>/<head>/<body> because the host adds its own.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const jsMatch = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/);
const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/);
if (!jsMatch || !cssMatch) throw new Error('Build with `vite build --base=./` first (use `npm run pack`).');

// Guard against an inline </script> ending the tag early.
const js = fs.readFileSync(path.join(dist, jsMatch[1]), 'utf8').replace(/<\/script/gi, '<\\/script');

// Inline only the subsets the app really uses; other @font-face files are dropped.
const KEEP = /(readex-pro-(arabic|latin)-wght-normal|fraunces-latin-opsz-normal|jetbrains-mono-latin-wght-normal)/;
let inlined = 0;
const css = fs.readFileSync(path.join(dist, cssMatch[1]), 'utf8').replace(/url\((\.\/)?([^)"']+\.woff2)\)/g, (_m, _p, file) => {
  const name = path.basename(file);
  if (!KEEP.test(name)) return 'url(data:font/woff2;base64,)';
  inlined++;
  const data = fs.readFileSync(path.join(dist, 'assets', name)).toString('base64');
  return `url(data:font/woff2;base64,${data})`;
});

const prepaint = html.match(/<script>\s*\/\/ Pre-paint[\s\S]*?<\/script>/);
if (!prepaint) throw new Error('pre-paint script not found in index.html');

const out = [
  '<title>Penniq</title>',
  '<meta name="description" content="Penniq — كل قرش بحسابه. محفظة الكاش والبنك وتتبع المصاريف بعملتك." />',
  prepaint[0],
  `<style>\n${css}\n</style>`,
  '<div id="root"></div>',
  `<script type="module">\n${js}\n</script>`,
  '',
].join('\n');

const outDir = path.join(root, 'publish');
fs.mkdirSync(outDir, { recursive: true });
const target = path.join(outDir, 'penniq.html');
fs.writeFileSync(target, out);
console.log(`wrote ${target} (${(out.length / 1024).toFixed(0)} KB, ${inlined} fonts inlined)`);
