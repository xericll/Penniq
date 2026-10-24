// Penniq theme directions: three ways to give every appearance more than one colour.
// Each theme fills the app's token roles with distinct hues: page, banknote, dock, coin, cash, bank, accent.
window.DIRECTIONS = [
  {
    id: 'A',
    ar: 'فئات الأوراق النقدية',
    en: 'Denominations',
    idea:
      'كل مظهر هو ورقة نقدية بلونها الخاص، مثل ألوان فئات اليورو والليرة. الورقة هي البطل، والصفحة ورقٌ هادئ، والشريط السفلي بلون مكمِّل مختلف تماماً.',
    roles: 'الورقة = لون الفئة · الشريط = لون مكمِّل · الكاش والبنك لونان مختلفان',
    heroes: ['vermilion', 'emerald', 'midnight'],
    themes: [
      { id: 'vermilion', ar: 'قرمزي', bg: '#f4ede6', surface: '#fbf7f2', ink: '#2a1d1b', primary: '#9e2b25', onPrimary: '#fff4ec', coin: '#d9a441', note: '#a3302a', note2: '#6e1c18', noteInk: '#fff1e6', noteFoil: '#f0c76a', nav: '#1f2a3a', navInk: '#aab4c4', cash: '#c8682b', bank: '#2f5d8a', accent: '#2a8c82', inc: '#2e7d4f', out: '#b23a2e' },
      { id: 'ultramarine', ar: 'لازوردي', bg: '#edf0f6', surface: '#f8f9fc', ink: '#151c33', primary: '#1f3c88', onPrimary: '#f2f5ff', coin: '#e8a53a', note: '#213f8f', note2: '#142756', noteInk: '#f4f6ff', noteFoil: '#f2c14e', nav: '#182447', navInk: '#9fb0d8', cash: '#e07a2e', bank: '#3f63c4', accent: '#e0607e', inc: '#237a4c', out: '#c8442f' },
      { id: 'saffron', ar: 'زعفراني', bg: '#fbf4e9', surface: '#fffaf3', ink: '#2a1a0c', primary: '#a8520f', onPrimary: '#fff6ec', coin: '#e0a63e', note: '#d9771e', note2: '#a4520e', noteInk: '#2a1406', noteFoil: '#5a2a0c', nav: '#2c2347', navInk: '#b3a9d6', cash: '#d9771e', bank: '#2c6e6a', accent: '#6a4c93', inc: '#3b7d3c', out: '#b23a2e' },
      { id: 'emerald', ar: 'زمردي', bg: '#edf3ef', surface: '#f8fbf9', ink: '#10241c', primary: '#17664a', onPrimary: '#effaf4', coin: '#d9b25a', note: '#1a6b4e', note2: '#0e4231', noteInk: '#f0fbf5', noteFoil: '#e6c66e', nav: '#3a1f2b', navInk: '#d1b3c1', cash: '#c98a2b', bank: '#2e6fa3', accent: '#c9564f', inc: '#1f7a4c', out: '#b8433a' },
      { id: 'amber', ar: 'كهرماني', bg: '#f7f1de', surface: '#fffbef', ink: '#2b230c', primary: '#4a2f6b', onPrimary: '#f7f0ff', coin: '#c99a2e', note: '#b8891c', note2: '#8f6a12', noteInk: '#23190a', noteFoil: '#4a2f6b', nav: '#2c2440', navInk: '#c2b6dc', cash: '#b8891c', bank: '#4a5fa8', accent: '#4a2f6b', inc: '#3d7a3a', out: '#b5402f' },
      { id: 'amethyst', ar: 'جَمَشْتي', bg: '#f2eef6', surface: '#fbf9fd', ink: '#21172f', primary: '#5a3d8a', onPrimary: '#f6f0ff', coin: '#d9b26a', note: '#5b3e8c', note2: '#36235a', noteInk: '#f7f1ff', noteFoil: '#e7c37a', nav: '#1c3b39', navInk: '#a9cfc9', cash: '#c4774a', bank: '#5b3e8c', accent: '#2f9b8f', inc: '#2f8058', out: '#b8433a' },
      { id: 'silver', ar: 'فضّي', bg: '#eceef0', surface: '#f9fafb', ink: '#1b2026', primary: '#36414f', onPrimary: '#f3f6f9', coin: '#d9a24b', note: '#55606f', note2: '#353d48', noteInk: '#f6f8fa', noteFoil: '#e9c77e', nav: '#20262e', navInk: '#a5afbb', cash: '#d1603d', bank: '#3f7cac', accent: '#d1603d', inc: '#2f7d57', out: '#c0392b' },
      { id: 'rose', ar: 'وردي', bg: '#f8eef0', surface: '#fff9fa', ink: '#2c1a1f', primary: '#a33a5a', onPrimary: '#fff2f5', coin: '#d6a75a', note: '#a8405f', note2: '#7a2846', noteInk: '#fff2f6', noteFoil: '#f3cf86', nav: '#253041', navInk: '#aeb8c8', cash: '#c86b3c', bank: '#3d6b8f', accent: '#3c8f7e', inc: '#2f7d57', out: '#b5352f' },
      { id: 'midnight', ar: 'حبر الليل', dark: true, bg: '#10141f', surface: '#1a2030', ink: '#eef0f5', primary: '#e3b65a', onPrimary: '#1b1606', coin: '#e3b65a', note: '#b9452f', note2: '#7e2a1d', noteInk: '#fff2ea', noteFoil: '#f3cf7a', nav: '#23304d', navInk: '#b2bdd6', cash: '#e39a4a', bank: '#7aa2e3', accent: '#57c4b0', inc: '#6fd39b', out: '#ff8a73' },
      { id: 'greenback', ar: 'أخضر الدولار', dark: true, bg: '#0f1a16', surface: '#17261f', ink: '#eaf3ee', primary: '#d8c27a', onPrimary: '#1a1709', coin: '#d8c27a', note: '#e9e4d0', note2: '#d6cfb4', noteInk: '#18392c', noteFoil: '#7a5a1e', nav: '#1f3a30', navInk: '#a9c7b9', cash: '#d8a24a', bank: '#79b7d6', accent: '#e0776a', inc: '#7cd6a2', out: '#ff9580' },
      { id: 'violet-night', ar: 'بنفسج الليل', dark: true, bg: '#171225', surface: '#221a35', ink: '#f1ecfa', primary: '#f0a85a', onPrimary: '#2a1504', coin: '#f0c46a', note: '#e07a3e', note2: '#b45a24', noteInk: '#2a1203', noteFoil: '#3a1d5a', nav: '#2f2450', navInk: '#bfb3dc', cash: '#f0a85a', bank: '#a58bf0', accent: '#4fc1b0', inc: '#78d6a0', out: '#ff8a7a' },
      { id: 'petrol', ar: 'فحمي بترولي', dark: true, bg: '#161616', surface: '#212121', ink: '#f3f0ea', primary: '#d4af5a', onPrimary: '#1a1405', coin: '#d4af5a', note: '#1f4e5a', note2: '#12323a', noteInk: '#eef7f8', noteFoil: '#e2c16e', nav: '#3a2f22', navInk: '#c9bba5', cash: '#e0a14a', bank: '#5fb0c4', accent: '#d8604a', inc: '#7ccf98', out: '#ff8e7a' },
    ],
  },
  {
    id: 'B',
    ar: 'مدن وأماكن',
    en: 'Places',
    idea:
      'كل مظهر مأخوذ من مكان حقيقي في بلادنا والمتوسط: ثلاثة ألوان من المكان نفسه، واحد للورقة، واحد للصفحة، وواحد للشريط والعملة. دمشق وردٌ وكرمة ونحاس، البتراء حجرٌ وردي وفيروز.',
    roles: 'ثلاثية لونية لكل مكان · الورقة والشريط من عائلتين مختلفتين',
    heroes: ['damascus', 'andalus', 'wadirum'],
    themes: [
      { id: 'damascus', ar: 'دمشق', note_: 'ورد جوري، كرمة، نحاس', bg: '#f7f1ec', surface: '#fffaf6', ink: '#2a1c1f', primary: '#7f2a3f', onPrimary: '#fff3f5', coin: '#c9973f', note: '#8c2f45', note2: '#5a1a2b', noteInk: '#fff2f4', noteFoil: '#e9c27a', nav: '#2e3b2f', navInk: '#b4c4b0', cash: '#c0563f', bank: '#3d6b5a', accent: '#c9973f', inc: '#3d7a4a', out: '#b23a3a' },
      { id: 'petra', ar: 'البتراء', note_: 'حجر وردي، فيروز', bg: '#f5e8de', surface: '#fff7f1', ink: '#2d1b14', primary: '#9c4a2f', onPrimary: '#fff3ea', coin: '#d9a95f', note: '#a8522f', note2: '#7a3520', noteInk: '#fff3ea', noteFoil: '#f2cf8a', nav: '#1f4e55', navInk: '#a8d0d2', cash: '#c9783f', bank: '#2f7a82', accent: '#2f7a82', inc: '#3d7a4a', out: '#a83a2a' },
      { id: 'beirut', ar: 'بيروت', note_: 'بحر، ليمون، برتقال', bg: '#edf3f6', surface: '#f9fcfd', ink: '#10222e', primary: '#1d5f8b', onPrimary: '#f0f8ff', coin: '#f0c13e', note: '#1e5f8c', note2: '#123e5e', noteInk: '#f2f9ff', noteFoil: '#f6d36a', nav: '#0f2f45', navInk: '#9cbad0', cash: '#e5873a', bank: '#2a86b8', accent: '#f0c13e', inc: '#2e8059', out: '#c8452f' },
      { id: 'andalus', ar: 'الأندلس', note_: 'زليج كوبالت، فخّار، مغرة', bg: '#f4efe5', surface: '#fffbf3', ink: '#1c2330', primary: '#1b4f72', onPrimary: '#f0f7ff', coin: '#e0a020', note: '#a8462a', note2: '#72291a', noteInk: '#fff3ea', noteFoil: '#f2c46a', nav: '#173f63', navInk: '#a9c2dc', cash: '#d98e04', bank: '#2a7a6f', accent: '#1b4f72', inc: '#2a7a4f', out: '#b5462a' },
      { id: 'aleppo', ar: 'حلب', note_: 'غار، صابون، كهرمان', bg: '#f1ecd9', surface: '#fbf8ec', ink: '#24240f', primary: '#55642a', onPrimary: '#f6f8e8', coin: '#c58b2a', note: '#5d6b2f', note2: '#3c4719', noteInk: '#f7f5e4', noteFoil: '#e6bd6a', nav: '#3a2a1c', navInk: '#d2bfa6', cash: '#c58b2a', bank: '#4f7f8a', accent: '#a94a34', inc: '#4a7a33', out: '#a94a34' },
      { id: 'luxor', ar: 'الأقصر', note_: 'ذهب، لازورد، عقيق', bg: '#f3ecdc', surface: '#fffaf0', ink: '#1a1f33', primary: '#24408e', onPrimary: '#f2f5ff', coin: '#d4a537', note: '#c99a2e', note2: '#a67c1c', noteInk: '#1b1d2e', noteFoil: '#24408e', nav: '#24408e', navInk: '#b8c6ec', cash: '#c2552d', bank: '#24408e', accent: '#c2552d', inc: '#2f7a52', out: '#b8452f' },
      { id: 'jaffa', ar: 'يافا', note_: 'برتقال، ورق شجر', bg: '#fdf4e8', surface: '#fffaf3', ink: '#1d2a22', primary: '#1f4d3a', onPrimary: '#effaf3', coin: '#f0a640', note: '#e0672a', note2: '#b04a17', noteInk: '#2a1306', noteFoil: '#1f4d3a', nav: '#1f4d3a', navInk: '#b5d3c2', cash: '#e0672a', bank: '#2c6a8a', accent: '#1f4d3a', inc: '#2f7a4a', out: '#c0392b' },
      { id: 'hermon', ar: 'جبل الشيخ', note_: 'ثلج، رمّان، أردواز', bg: '#eff2f6', surface: '#fafcfe', ink: '#1c2433', primary: '#3c4a63', onPrimary: '#f2f5fa', coin: '#c9a45a', note: '#9b2335', note2: '#651421', noteInk: '#fff1f3', noteFoil: '#f0c983', nav: '#222a38', navInk: '#a9b4c6', cash: '#c4485a', bank: '#3c6e9a', accent: '#3e8f7a', inc: '#2f7d57', out: '#b8323a' },
      { id: 'wadirum', ar: 'وادي رم ليلاً', note_: 'رمل أحمر، سماء بنفسجية', dark: true, bg: '#1d1524', surface: '#291f32', ink: '#f5ebe4', primary: '#f0b85a', onPrimary: '#2a1704', coin: '#f0b85a', note: '#b3502c', note2: '#7f3519', noteInk: '#fff3ea', noteFoil: '#f6cf7f', nav: '#3a2547', navInk: '#c7b5d3', cash: '#e8955a', bank: '#9b8fe0', accent: '#6cc4b4', inc: '#7fd3a0', out: '#ff8f78' },
      { id: 'aqaba', ar: 'العقبة', note_: 'بحر أحمر، مرجان', dark: true, bg: '#0e2a2e', surface: '#153a3f', ink: '#eaf5f3', primary: '#ff8c6b', onPrimary: '#2a0f06', coin: '#f6d06f', note: '#f28463', note2: '#c95a3c', noteInk: '#2a0e05', noteFoil: '#0e4a50', nav: '#0a4a50', navInk: '#a9d3d4', cash: '#f6d06f', bank: '#5cc3c0', accent: '#f6d06f', inc: '#7fe0b0', out: '#ffa08a' },
      { id: 'bzouriyeh', ar: 'سوق البزورية', note_: 'سمّاق، كركم، هيل', dark: true, bg: '#251510', surface: '#33201a', ink: '#f6e8da', primary: '#e2a03a', onPrimary: '#2a1602', coin: '#e2a03a', note: '#8f2d2f', note2: '#5e1a1c', noteInk: '#fff0e8', noteFoil: '#f0c062', nav: '#1f3a30', navInk: '#a9c9b8', cash: '#e2a03a', bank: '#6fa38d', accent: '#6fa38d', inc: '#8fd19e', out: '#ff8f7a' },
      { id: 'cairo', ar: 'ليل القاهرة', note_: 'نيل، فيروز، ذهب', dark: true, bg: '#121720', surface: '#1b222e', ink: '#f1ece2', primary: '#e5b85c', onPrimary: '#1f1605', coin: '#e5b85c', note: '#1f7a73', note2: '#12504b', noteInk: '#f0fbf9', noteFoil: '#f0c96e', nav: '#1d2f3d', navInk: '#a9bccb', cash: '#e5b85c', bank: '#5fb3a8', accent: '#e06a4f', inc: '#79d3a2', out: '#ff8d73' },
    ],
  },
  {
    id: 'C',
    ar: 'حبران على ورق',
    en: 'Two inks',
    idea:
      'كل مظهر مطبوع بحبرين متعاكسين على ورق، مثل طباعة الريزو والطوابع: حبر للورقة والشريط، وحبر معاكس للعملة والأرقام المهمة. أجرأ وأكثر حداثة، والتباين فيه أقوى ما يكون.',
    roles: 'حبر أول = الورقة والشريط · حبر معاكس = العملة والكاش والتمييز',
    heroes: ['blue-red', 'violet-yellow', 'forest-pink'],
    themes: [
      { id: 'blue-red', ar: 'أزرق وأحمر', bg: '#f4efe6', surface: '#fbf8f2', ink: '#1b2240', primary: '#2b4bae', onPrimary: '#f3f5ff', coin: '#e5483a', note: '#2b4bae', note2: '#1d3683', noteInk: '#f6f7ff', noteFoil: '#ff7a6a', nav: '#1d3683', navInk: '#b9c4f0', cash: '#e5483a', bank: '#2b4bae', accent: '#e5483a', inc: '#1a7a4f', out: '#c8352a' },
      { id: 'teal-pink', ar: 'فيروزي وزهري', bg: '#fbf2f1', surface: '#fffafa', ink: '#10302f', primary: '#00727a', onPrimary: '#effcfc', coin: '#e8467c', note: '#e8467c', note2: '#b8285a', noteInk: '#2a0614', noteFoil: '#00585e', nav: '#0b4a4f', navInk: '#a6d6d6', cash: '#e8467c', bank: '#00838a', accent: '#e8467c', inc: '#1a7a50', out: '#c8355a' },
      { id: 'green-orange', ar: 'أخضر وبرتقالي', bg: '#f2f0e4', surface: '#fbfaf2', ink: '#13281e', primary: '#1f6b4a', onPrimary: '#effaf3', coin: '#f28c28', note: '#1f6b4a', note2: '#134731', noteInk: '#f2fbf5', noteFoil: '#ffa94d', nav: '#134731', navInk: '#a8cdb8', cash: '#f28c28', bank: '#1f6b4a', accent: '#f28c28', inc: '#1f7a4c', out: '#c0401f' },
      { id: 'violet-yellow', ar: 'بنفسجي وأصفر', bg: '#f5f1e8', surface: '#fdfbf5', ink: '#20153a', primary: '#4b2e83', onPrimary: '#f7f2ff', coin: '#f2c230', note: '#f2c230', note2: '#d6a514', noteInk: '#22163d', noteFoil: '#4b2e83', nav: '#4b2e83', navInk: '#cbbbe8', cash: '#e09a14', bank: '#4b2e83', accent: '#f2c230', inc: '#2a7a4f', out: '#c8402f' },
      { id: 'wine-mint', ar: 'نبيذي ونعناعي', bg: '#f6efe9', surface: '#fffaf6', ink: '#2c0f1a', primary: '#7a1f3d', onPrimary: '#fff1f5', coin: '#3fb59a', note: '#7a1f3d', note2: '#4f1027', noteInk: '#fff1f5', noteFoil: '#6fe0c4', nav: '#2c0f1a', navInk: '#d0a9b6', cash: '#2e9c84', bank: '#7a1f3d', accent: '#3fb59a', inc: '#1d7660', out: '#c23a3a' },
      { id: 'brown-sky', ar: 'بنّي وسماوي', bg: '#f3ebe1', surface: '#fcf7f1', ink: '#2a1a10', primary: '#5a3522', onPrimary: '#fff5ee', coin: '#4aa3c7', note: '#4aa3c7', note2: '#2f86ab', noteInk: '#0d2430', noteFoil: '#5a3522', nav: '#5a3522', navInk: '#e0c8b8', cash: '#c27a3a', bank: '#2f86ab', accent: '#4aa3c7', inc: '#2f7d57', out: '#b8432f' },
      { id: 'coal-lime', ar: 'فحمي وليموني', bg: '#f5f4ea', surface: '#fffff7', ink: '#1c1c1c', primary: '#1f1f1f', onPrimary: '#f2f6c8', coin: '#d4e14b', note: '#232323', note2: '#0f0f0f', noteInk: '#f6f6ee', noteFoil: '#d4e14b', nav: '#1f1f1f', navInk: '#a7a79a', cash: '#9aa61c', bank: '#3a6fd8', accent: '#d4e14b', inc: '#2f7d57', out: '#d2452f' },
      { id: 'navy-coral', ar: 'كحلي ومرجاني', dark: true, bg: '#12172a', surface: '#1b2238', ink: '#eef1fa', primary: '#ff7a59', onPrimary: '#2a0c03', coin: '#7ad3c4', note: '#ff7a59', note2: '#e0583a', noteInk: '#2a0c03', noteFoil: '#12172a', nav: '#253a6b', navInk: '#b9c6e8', cash: '#ff7a59', bank: '#7ad3c4', accent: '#7ad3c4', inc: '#7ad3a0', out: '#ff8f7a' },
      { id: 'black-gold', ar: 'أسود وذهبي', dark: true, bg: '#111111', surface: '#1c1c1c', ink: '#f4f0e6', primary: '#e8c26a', onPrimary: '#1a1405', coin: '#e8c26a', note: '#e8c26a', note2: '#c9a04a', noteInk: '#1a1405', noteFoil: '#b8322a', nav: '#2a2418', navInk: '#c9bfa8', cash: '#e8c26a', bank: '#e0533d', accent: '#e0533d', inc: '#8fd6a0', out: '#ff7f6a' },
      { id: 'forest-pink', ar: 'غابة وزهري', dark: true, bg: '#0f2420', surface: '#16312b', ink: '#edf6f1', primary: '#f59ab0', onPrimary: '#2a0a14', coin: '#e9d77a', note: '#f59ab0', note2: '#e07a95', noteInk: '#2a0a14', noteFoil: '#0f4a3c', nav: '#1d4a3e', navInk: '#a9d0c1', cash: '#e9d77a', bank: '#f59ab0', accent: '#e9d77a', inc: '#8fe0b0', out: '#ff9a86' },
      { id: 'aubergine-lime', ar: 'باذنجاني وليموني', dark: true, bg: '#1a1222', surface: '#251a30', ink: '#f3eef8', primary: '#c8e05a', onPrimary: '#1c2208', coin: '#c8e05a', note: '#6f45c4', note2: '#4f2f9a', noteInk: '#fbf8ff', noteFoil: '#d6ec6a', nav: '#33234a', navInk: '#c2b5d6', cash: '#c8e05a', bank: '#a68bf0', accent: '#c8e05a', inc: '#8fe0b0', out: '#ff8f86' },
    ],
  },
];

// Ideas sketched but not developed (offered as alternates).
window.ALTERNATES = [
  { ar: 'أحجار كريمة', idea: 'ياقوت، زبرجد، فيروز، عقيق: كل مظهر حجر مع إطار ذهبي أو فضي.', sw: ['#9b1b30', '#2f7a5a', '#3fa3a8', '#d9a441'] },
  { ar: 'فصول السنة', idea: 'أربع عائلات (ربيع، صيف، خريف، شتاء)، بثلاث درجات لكل فصل، ويتبدل المظهر مع الشهر تلقائياً.', sw: ['#e9a0b4', '#f2b134', '#b4552d', '#3c5a8a'] },
  { ar: 'قهوة وشاي', idea: 'قهوة عربية بالهيل، شاي بالنعناع، كركديه، يانسون: ألوان دافئة من المطبخ.', sw: ['#5a3522', '#3f8f5a', '#9b2335', '#e8d6a8'] },
];
