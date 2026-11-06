// Builds every [data-edition] block of src/index.css from compact palettes, following the
// terracotta design: a page tinted with the theme hue, a saturated banknote, a light net pill,
// a dark dock whose active tab wears the hue, leaves in the hue. Checks text contrast.
// Usage (inside money-tracker/): node scripts/editions.cjs <out.css> <out.json>, then paste out.css over the
// appearance blocks in src/index.css (between "Appearances" and "Unlayered on purpose").
const T = [
  // The design the user supplied (November 2026): the new default light appearance.
  // Every value below was sampled from the design image (median colour of each element), so it matches it exactly.
  { id: 'terracotta', ar: 'تيراكوتا', de: 'Terrakotta', en: 'Terracotta', bg: '#f8eae1', surface: '#faebe3', surface2: '#ecd6c8', ink: '#2a1f17', ink2: '#4e4337', ink3: '#76685d',
    note: '#c95d37', note2: '#bf532b', noteHi: '#d6714a', noteInk: '#ffe4c8', noteInk2: '#ffdbbd', noteFoil: '#fea776', noteBank: '#fbe8d8', chip: '#f0d8c5', chipInk: '#3a2615',
    coin: '#df7847', onCoin: '#fff0de', coinRing: '#fbe4d0', assist: '#f3e0d2', dock: '#392e2b', navInk: '#efe4dc', navOn: '#ef8d5c', cash: '#c85d31', bank: '#c85d31',
    leaf: '#d76f42', iconTile: '#f2d0b5', grain: '0', line: 0.05, shadow: '0 1px 2px rgba(150, 95, 65, 0.1), 0 5px 13px rgba(150, 95, 65, 0.2)', noteShadow: '0 9px 20px -5px rgba(185, 85, 45, 0.42)', inc: '#3d7a4f', out: '#b9452a' },
  // Brand appearances
  { id: 'parchment', brand: true, bg: '#efeadf', surface: '#f8f5ee', ink: '#26271a', note: '#515233', note2: '#3f4027', noteInk: '#f3eee2', noteFoil: '#c2a97d', coin: '#c2a97d', dock: '#2a2b1b', navOn: '#d9c39a', cash: '#8a6d46', bank: '#515233', inc: '#3d6b3f', out: '#a3472f' },
  { id: 'navy', brand: true, dark: true, bg: '#1a2030', surface: '#222a3b', ink: '#efeadf', note: '#34436a', note2: '#232d47', noteInk: '#f4efe4', noteFoil: '#c2a97d', coin: '#c2a97d', dock: '#11151f', navOn: '#e2cfa6', cash: '#c2a97d', bank: '#8f9bb8', inc: '#7cb894', out: '#e3907a' },
  { id: 'olive', brand: true, dark: true, bg: '#33341f', surface: '#3e3f29', ink: '#f0ecdc', note: '#efeadf', note2: '#e2dbc9', noteInk: '#2e2f1d', noteFoil: '#8a6d46', coin: '#c9b07f', dock: '#202113', navOn: '#e6d3a8', cash: '#c9b07f', bank: '#b9bb95', inc: '#a8cf9a', out: '#eba184' },
  // Light
  { id: 'shore', ar: 'شاطئ', de: 'Ufer', en: 'Shore', bg: '#e9ecea', surface: '#f6f8f7', ink: '#0e2931', note: '#1f5a5e', note2: '#12484c', noteInk: '#eef6f5', noteFoil: '#e98e86', coin: '#a31c18', dock: '#0e2126', navOn: '#f0a49d', cash: '#1f5a5e', bank: '#2b7574', inc: '#25705a', out: '#861211' },
  { id: 'gilt', ar: 'ورق الذهب', de: 'Blattgold', en: 'Gilt', bg: '#f4efdf', surface: '#fbf8ef', ink: '#101a2c', note: '#1d3a66', note2: '#11284d', noteInk: '#f6f1e2', noteFoil: '#d5b370', coin: '#d5b370', dock: '#111a2b', navOn: '#e3c98e', cash: '#1d3a66', bank: '#3a5f8a', inc: '#2f7a52', out: '#b0452c' },
  { id: 'azure', ar: 'لازورد', de: 'Azur', en: 'Azure', bg: '#eaf1f9', surface: '#f7fafd', ink: '#0f2552', note: '#1c54b0', note2: '#17479c', noteInk: '#f2f7fc', noteFoil: '#ff9a6b', coin: '#f76c35', dock: '#0f1d3d', navOn: '#ff9a6b', cash: '#1c54b0', bank: '#1f7fbd', inc: '#22805a', out: '#c8421c' },
  { id: 'clouds', ar: 'غيوم', de: 'Wolken', en: 'Clouds', bg: '#fcf1e7', surface: '#fffaf5', ink: '#10284f', note: '#1d66c9', note2: '#1557ad', noteInk: '#f4f9ff', noteFoil: '#ffc88a', coin: '#ffbf6b', dock: '#13254a', navOn: '#ffc27a', cash: '#1d66c9', bank: '#3d80cb', inc: '#22805a', out: '#c8442c' },
  { id: 'dusk', ar: 'غروب', de: 'Abendrot', en: 'Dusk', bg: '#f3eae3', surface: '#fbf6f2', ink: '#1d2a38', note: '#33608f', note2: '#2a5078', noteInk: '#f6f1ec', noteFoil: '#f0b48a', coin: '#e0a276', dock: '#1d2733', navOn: '#efb48b', cash: '#33608f', bank: '#5b7d7d', inc: '#3a7656', out: '#b0493f' },
  { id: 'velvet', ar: 'مخمل', de: 'Samt', en: 'Velvet', bg: '#f3ebec', surface: '#fbf8f8', ink: '#14131c', note: '#7a3c51', note2: '#5e3443', noteInk: '#fbf2f3', noteFoil: '#f3aaa4', coin: '#d9433f', dock: '#1b1622', navOn: '#f08f8a', cash: '#7a3c51', bank: '#2a3a52', inc: '#2f7a52', out: '#b8322e' },
  // Dark
  { id: 'tide', ar: 'مدّ', de: 'Gezeiten', en: 'Tide', dark: true, bg: '#0e2931', surface: '#123740', ink: '#e2e2e0', note: '#2b7574', note2: '#1d5d5f', noteInk: '#f1f5f4', noteFoil: '#f2a39c', coin: '#ec6a62', dock: '#081a1f', navOn: '#f0857c', cash: '#6fb3b0', bank: '#9cc9c6', inc: '#7fd1b4', out: '#f0766c' },
  { id: 'koi', ar: 'كوي', de: 'Koi', en: 'Koi', dark: true, bg: '#101a2c', surface: '#172440', ink: '#f4efdf', note: '#2c5683', note2: '#1e3f66', noteInk: '#f6f1e2', noteFoil: '#e2c27f', coin: '#d5b370', dock: '#0a111e', navOn: '#e2c27f', cash: '#7fa3cf', bank: '#a9bfdc', inc: '#8fd0a8', out: '#f0875f' },
  { id: 'shoal', ar: 'سِرب', de: 'Schwarm', en: 'Shoal', dark: true, bg: '#161f33', surface: '#1e2a44', ink: '#eef0f5', note: '#3d5684', note2: '#2c4168', noteInk: '#f2f4f8', noteFoil: '#e3c060', coin: '#d5b050', dock: '#0e1524', navOn: '#e3c060', cash: '#8ea4cc', bank: '#b3c0da', inc: '#8fd0a8', out: '#f08a7a' },
  { id: 'deep', ar: 'أعماق', de: 'Tiefsee', en: 'Deep sea', dark: true, bg: '#0e1f45', surface: '#152a5a', ink: '#eef5fb', note: '#1a74b0', note2: '#17549c', noteInk: '#f2f8fd', noteFoil: '#ffa27a', coin: '#f76c35', dock: '#081430', navOn: '#ff9a6b', cash: '#6fb3e3', bank: '#99c3de', inc: '#8fe0b0', out: '#ff8a6a' },
  { id: 'whale', ar: 'حوت', de: 'Wal', en: 'Whale', dark: true, bg: '#182231', surface: '#213044', ink: '#f3ece6', note: '#e0a276', note2: '#c98b60', noteInk: '#2a1a10', noteFoil: '#2e5a88', coin: '#e0a276', dock: '#0f1620', navOn: '#e8b08a', cash: '#e0a276', bank: '#93b3b3', inc: '#8fd6a8', out: '#f09482' },
  { id: 'noir', ar: 'نوار', de: 'Noir', en: 'Noir', dark: true, bg: '#0b0a12', surface: '#151826', ink: '#f1eef2', note: '#1a3470', note2: '#0d2350', noteInk: '#f1eef2', noteFoil: '#ef6a64', coin: '#d9433f', dock: '#050409', navOn: '#f07a74', cash: '#8d9bb5', bank: '#b8c2d4', inc: '#8fd6a8', out: '#ff7a72' },
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const rgba = (h, a) => `rgba(${hex(h).join(', ')}, ${a})`;
const lum = (h) => {
  const c = hex(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const reach = (c, to, bgs, min) => { let t = 0, out = c; while (bgs.some((b) => cr(out, b) < min) && t < 1) { t += 0.02; out = mix(c, to, t); } return out; };
const on = (c, a, b) => (cr(c, a) >= cr(c, b) ? a : b);

const problems = [];
function block(p) {
  const d = !!p.dark;
  // Any value a palette states (sampled from a design) wins over the derived one.
  const surface2 = p.surface2 ?? mix(p.surface, p.ink, d ? 0.07 : 0.06);
  const backs = [p.bg, p.surface, surface2];
  const ink2 = p.ink2 ?? reach(mix(p.ink, p.bg, 0.3), p.ink, backs, 7);
  const ink3 = p.ink3 ?? reach(mix(p.ink, p.bg, 0.45), p.ink, backs, 4.6);
  const foil = d ? reach(p.coin, '#ffffff', [p.surface], 4.5) : reach(p.coin, p.ink, [p.surface, p.bg], 4.5);
  const darkInk = d ? p.bg : p.ink;
  const lightInk = d ? p.ink : p.surface;
  // Primary buttons: the banknote colour on light pages, the coin on dark ones.
  const primary = d ? p.coin : reach(p.note, p.note2, [p.surface], 3);
  const onPrimary = on(primary, d ? p.bg : p.ink, '#ffffff');
  const chip = p.chip ?? mix(p.noteInk, p.note, 0.1);
  const chipInk = p.chipInk ?? on(chip, mix(p.note2, '#000000', 0.62), p.note);
  const navInk = p.navInk ?? reach(mix(p.dock, '#ffffff', 0.62), '#ffffff', [p.dock], 4.6);
  const t = {
    'color-scheme': d ? 'dark' : 'light',
    '--bg': p.bg,
    '--bg-elev': mix(p.bg, p.surface, 0.5),
    '--surface': p.surface,
    '--surface-2': surface2,
    '--line': rgba(p.ink, p.line ?? (d ? 0.1 : 0.08)),
    '--line-strong': rgba(p.ink, d ? 0.19 : 0.16),
    '--ink': p.ink,
    '--ink-2': ink2,
    '--ink-3': ink3,
    '--foil': foil,
    '--foil-hi': mix(p.coin, '#ffffff', 0.3),
    '--foil-lo': mix(foil, '#000000', 0.2),
    '--on-foil': on(foil, darkInk, lightInk),
    '--primary': primary,
    '--primary-hi': mix(primary, '#ffffff', 0.14),
    '--primary-lo': mix(primary, '#000000', 0.16),
    '--on-primary': onPrimary,
    '--coin': p.coin,
    '--coin-hi': mix(p.coin, '#ffffff', 0.3),
    '--coin-lo': mix(p.coin, '#000000', 0.18),
    '--on-coin': p.onCoin ?? on(p.coin, d ? p.bg : p.ink, '#ffffff'),
    // The ring round the transfer coin and the + button, and the filled assistant button.
    '--coin-ring': p.coinRing ?? (d ? p.bg : mix(p.surface, p.coin, 0.08)),
    '--assist-bg': p.assist ?? mix(p.surface, p.coin, d ? 0.14 : 0.12),
    // The rounded square behind the cash and bank icons.
    '--icon-tile': p.iconTile ?? mix(p.surface, p.cash, d ? 0.2 : 0.22),
    '--in': p.inc,
    '--out': p.out,
    '--cash': p.cash,
    '--bank': p.bank,
    '--note-bg': p.note,
    '--note-bg-2': p.note2,
    '--note-ink': p.noteInk,
    '--note-ink-2': p.noteInk2 ?? reach(mix(p.noteInk, p.note, 0.2), p.noteInk, [p.note, p.note2], 4.6),
    '--note-line': rgba(p.noteFoil, 0.32),
    '--note-foil': p.noteFoil,
    // Light in the note's top corner, the bank share of its split bar, and its shadow.
    '--note-hi': p.noteHi ?? mix(p.note, '#ffffff', 0.12),
    '--note-bank': p.noteBank ?? mix(p.noteInk, p.note, 0.1),
    '--note-shadow': p.noteShadow ?? (d ? '0 22px 40px -22px rgba(0, 0, 0, 0.7)' : `0 9px 20px -6px ${rgba(p.note2, 0.4)}`),
    '--note-chip': chip,
    '--note-chip-ink': chipInk,
    '--nav-bg': p.dock,
    '--nav-ink': navInk,
    '--nav-ink-on': p.navOn,
    // Leaves in shades of the banknote colour; the brand appearances keep their olive fruit.
    '--leaf-a': p.brand ? '#5f6339' : p.note2,
    '--leaf-b': p.brand ? '#868a5c' : (p.leaf ?? p.note),
    '--leaf-c': p.brand ? '#b4b693' : mix(p.note, '#ffffff', 0.35),
    '--leaf-d': p.brand ? '#d3d4bd' : mix(p.note, '#ffffff', 0.62),
    '--stem': p.brand ? '#6f6141' : mix(p.note2, '#000000', 0.12),
    '--leaf-shadow': d ? 'rgba(0, 0, 0, 0.42)' : rgba(p.ink, 0.22),
    '--leaf-opacity': d ? '0.85' : '1',
    '--fruit-opacity': p.brand ? '1' : '0',
    '--scrim': rgba(d ? mix(p.bg, '#000000', 0.5) : p.ink, d ? 0.62 : 0.45),
    // Soft, warm shadow close under every card, as in the design.
    '--shadow':
      p.shadow ??
      (d
        ? '0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 18px 40px -24px rgba(0, 0, 0, 0.75)'
        : `0 1px 2px ${rgba(mix(p.note2, p.ink, 0.5), 0.08)}, 0 5px 13px ${rgba(mix(p.note2, p.ink, 0.5), 0.16)}`),
    '--grain-opacity': p.grain ?? (d ? '0.04' : '0.035'),
  };
  const checks = [
    ['ink-3/surface-2', ink3, surface2, 4.5], ['foil/surface', foil, p.surface, 4.5], ['on-primary', onPrimary, primary, 4.5],
    ['on-coin', t['--on-coin'], p.coin, 3], ['note-ink', p.noteInk, p.note, 4.5], ['note-ink/note2', p.noteInk, p.note2, 4.5],
    ['chip', chipInk, chip, 4.5], ['nav-ink', navInk, p.dock, 4.5], ['nav-on', p.navOn, p.dock, 4.5],
    ['in', p.inc, p.surface, 4.5], ['out', p.out, p.surface, 4.5], ['cash icon', p.cash, p.surface, 3], ['bank icon', p.bank, p.surface, 3],
  ];
  for (const [n, a, b, m] of checks) if (cr(a, b) < m) problems.push(`${p.id} ${n} ${cr(a, b).toFixed(2)} < ${m}`);
  const sel = p.id === 'terracotta' ? `:root,\n[data-edition="terracotta"]` : `[data-edition="${p.id}"]`;
  return `${sel} {\n` + Object.entries(t).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';
}

const css = T.map(block).join('\n\n');
require('fs').writeFileSync(process.argv[2], css + '\n');
require('fs').writeFileSync(process.argv[3], JSON.stringify(T.map(({ id, ar, de, en, dark, bg }) => ({ id, ar, de, en, dark: !!dark, bg }))));
console.log(problems.length ? problems.join('\n') : 'contrast ok');
