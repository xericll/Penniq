// Copies the receipt-scanning files into public/ocr/ so the app serves them itself (no CDN):
// the Tesseract worker, its WebAssembly core (three builds; the browser picks the one it supports)
// and the German language data. Runs before `npm run dev` and `npm run build`.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'public', 'ocr');
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz', 'deu.traineddata.gz'],
];

fs.mkdirSync(out, { recursive: true });
let copied = 0;
for (const [from, to] of files) {
  const src = path.join(root, 'node_modules', from);
  const dst = path.join(out, to);
  if (!fs.existsSync(src)) throw new Error(`missing ${from} — run npm install`);
  const same = fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size;
  if (!same) {
    fs.copyFileSync(src, dst);
    copied++;
  }
}
console.log(`ocr: ${copied ? `${copied} file(s) copied` : 'up to date'} in public/ocr`);
