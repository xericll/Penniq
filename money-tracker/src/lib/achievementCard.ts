/* Draws a shareable achievement card in Penniq's brand look — Ledger Navy paper, coin gold,
   guilloché rosettes and a beaded frame — on a canvas, in story (1080×1920) or square (1080×1080). */

import { SYMBOL, WORDMARK } from '../components/ui/brandArt';

export interface CardContent {
  /** The big figure: "20%", a level number, "✓". */
  headline: string;
  /** One or two sentences under it. */
  title: string;
  /** Smaller line, e.g. the amounts when the user chose to show them. */
  detail?: string;
  /** Small caps line at the top ("This month", the month name). */
  eyebrow: string;
  /** A goal's photo (data URL), drawn in the medallion instead of the mark. */
  photo?: string;
  dir: 'rtl' | 'ltr';
  lang: string;
  link: string;
}

const NAVY = '#1f2635';
const NAVY_2 = '#273047';
const GOLD = '#c2a97d';
const GOLD_HI = '#e2cfa6';
const GOLD_LO = '#9c8256';
const PARCHMENT = '#efeadf';
const PARCHMENT_2 = 'rgba(239,234,223,0.68)';

const DISPLAY = '"Playfair Display Variable", "Amiri", Georgia, serif';
const SANS = '"Manrope Variable", "IBM Plex Sans Arabic", system-ui, sans-serif';
const ARABIC_DISPLAY = '"Amiri", "Playfair Display Variable", serif';

function rosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 36; i++) {
    ctx.rotate(Math.PI / 36);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha * 1.4;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.28 + k * 0.05), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function drawAchievement(content: CardContent, format: 'story' | 'square'): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = format === 'story' ? 1920 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const arabic = content.lang === 'ar';
  const display = arabic ? ARABIC_DISPLAY : DISPLAY;

  // Make sure the brand fonts are ready before measuring text.
  try {
    await Promise.all([
      document.fonts.load(`400 120px ${DISPLAY}`, content.headline),
      document.fonts.load(`700 60px ${ARABIC_DISPLAY}`, content.title),
      document.fonts.load(`500 40px ${SANS}`, content.title),
    ]);
  } catch {
    // Falls back to system fonts.
  }

  // Paper
  const bg = ctx.createRadialGradient(W * 0.85, H * 0.05, 40, W * 0.5, H * 0.5, H * 0.9);
  bg.addColorStop(0, NAVY_2);
  bg.addColorStop(1, NAVY);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  rosette(ctx, W * 0.92, H * 0.06, 360, 0.14);
  rosette(ctx, W * 0.04, H * 0.97, 300, 0.09);

  // Beaded frame
  const m = 48;
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  roundRect(ctx, m, m, W - 2 * m, H - 2 * m, 40);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = GOLD;
  for (let x = m + 60; x < W - m - 40; x += 34) {
    ctx.beginPath();
    ctx.arc(x, m + 22, 3, 0, Math.PI * 2);
    ctx.arc(x, H - m - 22, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.direction = content.dir;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = W / 2;
  const story = format === 'story';
  // Content is about 1000 px tall in a story: start low enough to sit in the optical middle.
  let y = story ? 480 : 150;

  // Eyebrow
  ctx.fillStyle = GOLD;
  ctx.font = `600 ${story ? 34 : 30}px ${SANS}`;
  if (!arabic) ctx.letterSpacing = '6px';
  ctx.fillText(arabic ? content.eyebrow : content.eyebrow.toUpperCase(), cx, y);
  ctx.letterSpacing = '0px';

  // Medallion: the goal's photo, or the mark struck in gold
  const r = story ? 150 : 104;
  y += story ? 80 + r : 40 + r;
  const coin = ctx.createRadialGradient(cx - r * 0.3, y - r * 0.35, r * 0.1, cx, y, r);
  coin.addColorStop(0, GOLD_HI);
  coin.addColorStop(0.55, GOLD);
  coin.addColorStop(1, GOLD_LO);
  ctx.fillStyle = coin;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();
  const photo = content.photo ? await loadImage(content.photo) : null;
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, y, r - 10, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(photo, cx - r + 10, y - r + 10, (r - 10) * 2, (r - 10) * 2);
    ctx.restore();
  } else {
    const s = (r * 1.15) / SYMBOL.width;
    ctx.save();
    ctx.translate(cx - (SYMBOL.width * s) / 2, y - (SYMBOL.height * s) / 2);
    ctx.scale(s, s);
    ctx.fillStyle = NAVY;
    ctx.fill(new Path2D(SYMBOL.coin));
    ctx.fill(new Path2D(SYMBOL.cradle));
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, y, r - 5, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();

  // Headline figure
  y += r + (story ? 230 : 150);
  ctx.fillStyle = GOLD_HI;
  ctx.font = `400 ${story ? 230 : 150}px ${DISPLAY}`;
  ctx.direction = 'ltr';
  ctx.fillText(content.headline, cx, y);
  ctx.direction = content.dir;

  // Title
  ctx.fillStyle = PARCHMENT;
  ctx.font = `700 ${story ? 66 : 50}px ${display}`;
  const lines = wrap(ctx, content.title, W - 2 * m - 120);
  y += story ? 110 : 80;
  for (const line of lines.slice(0, 3)) {
    ctx.fillText(line, cx, y);
    y += story ? 86 : 64;
  }

  if (content.detail) {
    ctx.fillStyle = PARCHMENT_2;
    ctx.font = `500 ${story ? 40 : 32}px ${SANS}`;
    y += story ? 14 : 4;
    for (const line of wrap(ctx, content.detail, W - 2 * m - 140).slice(0, 2)) {
      ctx.fillText(line, cx, y);
      y += story ? 54 : 44;
    }
  }

  // Footer: the mark and the outlined wordmark, then the link
  const footY = H - m - (story ? 150 : 110);
  const markH = story ? 54 : 44;
  const ms = markH / SYMBOL.height;
  const ws = (markH * 0.62) / WORDMARK.height;
  const total = SYMBOL.width * ms + 18 + WORDMARK.width * ws;
  const x0 = cx - total / 2;
  ctx.save();
  ctx.translate(x0, footY - markH);
  ctx.scale(ms, ms);
  ctx.fillStyle = GOLD;
  ctx.fill(new Path2D(SYMBOL.coin));
  ctx.fillStyle = PARCHMENT;
  ctx.fill(new Path2D(SYMBOL.cradle));
  ctx.restore();
  ctx.save();
  ctx.translate(x0 + SYMBOL.width * ms + 18, footY - markH * 0.8);
  ctx.scale(ws, ws);
  ctx.fillStyle = PARCHMENT;
  ctx.fill(new Path2D(WORDMARK.d));
  ctx.restore();
  ctx.fillStyle = PARCHMENT_2;
  ctx.font = `500 ${story ? 32 : 28}px ${SANS}`;
  ctx.direction = 'ltr';
  ctx.fillText(content.link.replace(/^https?:\/\//, ''), cx, footY + (story ? 64 : 52));

  return canvas;
}
