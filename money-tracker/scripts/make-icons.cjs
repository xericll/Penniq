// Renders the app icons and the favicon from the monogram artwork: `npm run icons`.
// The monogram (src/assets/brand/penniq-monogram.svg) has gradients and hairlines, so it is drawn
// by headless Chrome. Set CHROME to the browser's path if it is not in the default place.
// Tiles: the logo's own cream, the monogram's navy P in the middle.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME =
  process.env.CHROME ||
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(
    (p) => fs.existsSync(p),
  );
if (!CHROME) throw new Error('Chrome not found: set CHROME to its path.');

const CREAM = '#f5f0e5';
const NAVY = '#1f2635';
const root = path.join(__dirname, '..');
const mono = fs.readFileSync(path.join(root, 'src', 'assets', 'brand', 'penniq-monogram.svg'), 'utf8').replace(/currentColor/g, NAVY);
const out = path.join(root, 'public');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'penniq-icons-'));

/** One square tile: cream, optionally rounded, with the monogram at `scale` of its height, nudged to look centred. */
function render(name, size, { scale, radius = 0 }) {
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;background:${CREAM};border-radius:${radius * size}px;display:grid;place-items:center">
<div style="height:${scale * size}px;margin-left:${0.03 * size}px">${mono.replace('<svg ', '<svg height="100%" ')}</div></div></body></html>`;
  const page = path.join(tmp, `${name}.html`);
  fs.writeFileSync(page, html);
  const shot = path.join(out, name);
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    `--screenshot=${shot}`,
    `file:///${page.replace(/\\/g, '/')}`,
  ]);
  console.log('wrote', name);
  return shot;
}

render('icon-192.png', 192, { scale: 0.72 });
render('icon-512.png', 512, { scale: 0.72 });
// Maskable icons are cropped to a circle of 80%: keep the monogram inside it.
render('icon-maskable-512.png', 512, { scale: 0.56 });
render('apple-touch-icon.png', 180, { scale: 0.7 });
const fav = render('favicon-64.png', 64, { scale: 0.8, radius: 0.22 });

// Favicon: a small SVG wrapping the 64px render (the full artwork would weigh 200 KB).
const data = fs.readFileSync(fav).toString('base64');
fs.writeFileSync(
  path.join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${data}"/></svg>\n`,
);
fs.unlinkSync(fav);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote favicon.svg');
