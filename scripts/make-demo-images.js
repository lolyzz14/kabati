// Makes the sample photos used by sample shops and by the pretend Instagram (FAKE_IG=1).
// Run: node scripts/make-demo-images.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SHAPE = {
  dress: ['M41 8 L41 22 L33 34 L22 132 L78 132 L67 34 L59 22 L59 8', 'M41 22 Q50 28 59 22 M33 34 Q50 42 67 34 M40 60 L36 132 M60 60 L64 132'],
  bottom: ['M28 10 L72 10 L76 132 L56 132 L50 48 L44 132 L24 132 Z', 'M28 18 L72 18 M36 18 Q38 32 30 34 M64 18 Q62 32 70 34 M50 18 L50 40'],
  shorts: ['M26 30 L74 30 L78 92 L56 92 L50 58 L44 92 L22 92 Z', 'M26 38 L74 38'],
  outer: ['M36 12 L50 24 L64 12 L84 22 L92 96 L80 98 L78 56 L78 124 L22 124 L22 56 L20 98 L8 96 L16 22 Z', 'M36 12 L44 62 L50 24 L56 62 L64 12'],
  top: ['M34 16 Q50 30 66 16 L88 34 L78 50 L70 44 L70 118 L30 118 L30 44 L22 50 L12 34 Z', 'M30 104 L70 104'],
  vase: ['M38 14 L62 14 L60 34 Q86 56 78 98 Q74 128 50 128 Q26 128 22 98 Q14 56 40 34 Z', 'M40 34 Q50 40 60 34'],
  pillow: ['M14 30 Q50 18 86 30 Q94 70 86 110 Q50 122 14 110 Q6 70 14 30 Z', 'M30 50 L70 90 M70 50 L30 90'],
};

const PHOTOS = [
  ['linen-midi', 'dress', '#D9A43B', '#F3E6CF'],
  ['wide-leg', 'bottom', '#E2C99A', '#EFE8DC'],
  ['satin-blouse', 'top', '#EBD9B4', '#E9E1D3'],
  ['denim-jacket', 'outer', '#9FB1C9', '#E4E8EE'],
  ['floral-wrap', 'dress', '#E0B4A4', '#F4E9E4'],
  ['mom-jeans', 'bottom', '#B9C3D3', '#E7EAF0'],
  ['wool-blazer', 'outer', '#C9A27E', '#EFE6DC'],
  ['silk-cami', 'top', '#E6C3B5', '#F3EAE6'],
  ['pleated-maxi', 'dress', '#A9B89A', '#ECEFE7'],
  ['linen-shorts', 'shorts', '#E6DCC8', '#F2EEE6'],
  ['cargo-shorts', 'shorts', '#A9B89A', '#EEF0EA'],
  ['oxford-shirt', 'top', '#C9D4E3', '#EDF0F5'],
  ['chinos', 'bottom', '#D7C3A0', '#F1ECE2'],
  ['overcoat', 'outer', '#8C8F96', '#E8E9EB'],
  ['mini-dress', 'dress', '#8FA3BF', '#E9EDF3'],
  ['ceramic-vase', 'vase', '#C9D4C3', '#EEF1EC'],
  ['throw-pillow', 'pillow', '#E2C99A', '#F3EEE4'],
  ['kitenge-skirt', 'bottom', '#E9A21A', '#F6EEDC'],
  ['dark-blurry', 'dress', '#3a3a3a', '#2a2a2a'],
  ['bale-announcement', null, '#C8102E', '#C8102E'],
];

function svg(shape, tone, bg, label) {
  const W = 1080, H = 1350;
  let body;
  if (!shape) {
    body = '<text x="540" y="620" font-family="Georgia" font-size="110" fill="#fff" text-anchor="middle">NEW BALE</text><text x="540" y="760" font-family="Georgia" font-size="80" fill="#fff" text-anchor="middle">Sunday 9am</text>';
  } else {
    const s = SHAPE[shape];
    body = '<rect x="140" y="140" width="800" height="1070" rx="30" fill="' + tone + '" opacity="0.18"/>' +
      '<g transform="translate(290 225) scale(5)"><path d="' + s[0] + '" fill="' + tone + '" stroke="#1A1410" stroke-width="1.2" stroke-linejoin="round"/><path d="' + s[1] + '" fill="none" stroke="#1A1410" stroke-width="1.2"/></g>';
  }
  return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><rect width="100%" height="100%" fill="' + bg + '"/>' + body + '</svg>');
}

(async () => {
  const dir = path.join(__dirname, '..', 'public', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, shape, tone, bg] of PHOTOS) {
    let img = sharp(svg(shape, tone, bg));
    if (name === 'dark-blurry') img = img.blur(18).modulate({ brightness: 0.5 });
    await img.jpeg({ quality: 82 }).toFile(path.join(dir, name + '.jpg'));
    // a second photo of the same piece, slightly different (as if shot again)
    await sharp(svg(shape, tone, bg)).rotate(0).extract({ left: 40, top: 50, width: 1000, height: 1250 }).resize(1080, 1350).modulate({ brightness: 1.04 }).jpeg({ quality: 70 }).toFile(path.join(dir, name + '-b.jpg'));
  }
  console.log('Sample photos written to public/demo');
})();
