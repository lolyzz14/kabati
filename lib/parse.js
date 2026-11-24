// Reads an Instagram caption without AI. Used when no AI key is set, and to double-check the AI.
const CATS = [
  ['dress', /\b(dress(es)?|gown|kaftan)\b/i],
  ['outer', /\b(jacket|coat|blazer|cardigan|hoodie|trench|overcoat|bomber|parka)\b/i],
  ['bottom', /\b(trousers?|pants|jeans|skirts?|shorts|chinos|leggings|culottes|joggers)\b/i],
  ['top', /\b(top|blouse|shirt|tee|t-shirt|tshirt|cami|camisole|polo|bodysuit|sweater|jumper|tank|vest|crop)\b/i],
  ['shoes', /\b(shoes?|sneakers|heels|boots|sandals|loafers|flats|trainers)\b/i],
  ['bag', /\b(bag|handbag|purse|tote|clutch|backpack)\b/i],
  ['home', /\b(vase|pillow|cushion|mug|plate|curtains?|duvet|rug|bedsheet|throw|lamp|bowl|jug)\b/i],
];
const SUBS = [
  ['mini', /\bmini\b/i], ['midi', /\bmidi\b/i], ['maxi', /\bmaxi\b/i],
  ['shorts', /\bshorts\b/i], ['skirt', /\bskirts?\b/i], ['jeans', /\bjeans\b/i], ['trousers', /\b(trousers?|pants|chinos)\b/i],
];
const COND = /\b(mint condition|brand new with tags|brand new|new with tags|like new|excellent condition|good condition|worn once|never worn)\b/i;
const FABRIC = /\b(100% ?)?(linen|cotton|silk|wool|denim|satin|chiffon|viscose|leather|polyester|velvet|knit|lace)\b/i;
const MEN = /\b(men'?s|mens|gents|for him|male)\b/i;
const SOLD = /(^|\s|\W)sold(\s|\W|$)/i;
const NOT_SOLD = /\b(not sold|unsold|sold out soon)\b/i;

function titleCase(s) {
  s = s.trim().replace(/\s+/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function cleanText(t) {
  return String(t || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ');
}

function findSize(t) {
  let m = t.match(/\b(?:size|sz|uk|s\/z)\s*[:\-.]?\s*(\d{1,2}|xxs|xs|s|m|l|xl|xxl|xxxl)\b/i);
  const w = t.match(/\bw\s?(\d{2})\b/i);
  if (m) {
    const v = m[1].toUpperCase();
    return { value: /^\d+$/.test(v) ? String(Number(v)) : v, label: /^\d+$/.test(v) ? String(Number(v)) + (w ? ' · W' + w[1] : '') : v + (w ? ' · W' + w[1] : '') };
  }
  m = t.match(/\b(xxs|xs|xxl|xxxl|xl)\b/i);
  if (m) return { value: m[1].toUpperCase(), label: m[1].toUpperCase() };
  if (w) return { value: null, label: 'W' + w[1], waist: Number(w[1]) };
  return null;
}

function findPrice(t) {
  const strong = [
    /(?:ksh|kes|sh)\.?\s*([\d][\d,]{1,6})/i,
    /([\d][\d,]{1,6})\s*(?:\/=|\/-|bob|ksh|kes|shillings)/i,
    /(?:price|now|@)\s*[:\-]?\s*([\d][\d,]{1,6})/i,
  ];
  for (const re of strong) {
    const m = t.match(re);
    if (m) return { price: Number(m[1].replace(/,/g, '')), sure: true };
  }
  // bare numbers that are not sizes, waist, codes or measurements
  const stripped = t
    .replace(/\b(?:size|sz|uk)\s*[:\-.]?\s*\d{1,2}\b/gi, ' ')
    .replace(/\bw\s?\d{2}\b/gi, ' ')
    .replace(/\b(?:no\.?|#|item)\s*\d{1,4}\b/gi, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:cm|inches|in|")/gi, ' ')
    .replace(/\d+\s*%/g, ' ');
  const nums = (stripped.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d{3,5}\b/g) || []).map((n) => Number(n.replace(/,/g, ''))).filter((n) => n >= 100 && n <= 100000);
  if (nums.length === 1) return { price: nums[0], sure: true };
  if (nums.length > 1) return { price: Math.max.apply(null, nums), sure: false, numbers: nums };
  return null;
}

function findCode(t) {
  const m = t.match(/\b(?:no\.?|item|code)\s*[:#]?\s*(\d{1,4})\b|#(\d{1,4})\b/i);
  return m ? (m[1] || m[2]) : null;
}

function findMeasurements(t) {
  const out = [];
  const re = /\b(pit to pit|p2p|bust|chest|waist|hips?|length|inseam|shoulders?|sleeve|height|opening|size)\s*[:\-]?\s*(\d{1,3}(?:\.\d)?)\s*(cm|in|inches)\b/gi;
  let m;
  while ((m = re.exec(t))) out.push([titleCase(m[1] === 'p2p' ? 'pit to pit' : m[1]), m[2] + ' ' + (m[3].toLowerCase().startsWith('in') ? 'in' : 'cm')]);
  return out;
}

function findName(t, cat) {
  if (!cat) return null;
  const re = CATS.filter((c) => c[0] === cat)[0][1];
  const m = t.match(re);
  if (!m) return (cat === 'dress' && /\b(mini|midi|maxi)\b/i.test(t)) ? titleCase(t.match(/\b(\w+\s+)?(mini|midi|maxi)\b/i)[0] + ' dress') : null;
  const before = t.slice(0, m.index).split(/[\n|,.:;!?–—()]|\s-\s/).pop().trim().split(/\s+/).filter((w) => /^[a-z'’-]+$/i.test(w) && !/^(no|size|sz|and|the|this|my|our|a|an|new|still|available|now|sold)$/i.test(w));
  const words = before.slice(-3).concat([m[0]]);
  return titleCase(words.join(' '));
}

function readPiece(t) {
  const text = cleanText(t);
  const catEntry = CATS.filter((c) => c[1].test(text))[0];
  let category = catEntry ? catEntry[0] : null;
  if (!category && /\b(mini|midi|maxi)\b/i.test(text)) category = 'dress';
  const sub = SUBS.filter((s) => s[1].test(text))[0];
  const size = findSize(text);
  const price = findPrice(text);
  const cond = text.match(COND);
  const fab = text.match(/\b(100% ?)(linen|cotton|silk|wool|denim|satin|chiffon|viscose|leather|polyester|velvet|knit|lace)\b/i) || text.match(FABRIC);
  const unsure = [];
  if (!price) unsure.push('price');
  else if (!price.sure) unsure.push('price_or_code');
  if (!size && category && category !== 'home' && category !== 'bag') unsure.push('size');
  if (!category) unsure.push('category');
  return {
    name: findName(text, category) || (category ? titleCase(category === 'bottom' ? 'trousers' : category) : 'Piece'),
    category: category || 'other',
    subtype: sub ? sub[0] : null,
    gender: MEN.test(text) ? 'm' : 'w',
    size_value: size ? size.value : null,
    size_label: size ? size.label : (category === 'home' ? 'One size' : null),
    price: price ? price.price : null,
    price_numbers: price && price.numbers ? price.numbers : null,
    condition: cond ? titleCase(cond[1]) : null,
    fabric: fab ? (fab[1] ? '100% ' : '') + fab[2].toLowerCase() : null,
    measurements: findMeasurements(text),
    seller_code: findCode(text),
    unsure,
  };
}

// Whole caption -> { is_product, sold, pieces[] }. Several pieces when lines each name a price.
function readCaption(caption, photoCount) {
  const text = cleanText(caption || '');
  const sold = SOLD.test(text) && !NOT_SOLD.test(text);
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const pieceLines = lines.filter((l) => findPrice(l) && CATS.some((c) => c[1].test(l)));
  let pieces;
  if (pieceLines.length > 1) {
    const shared = lines.filter((l) => pieceLines.indexOf(l) < 0).join(' ');
    pieces = pieceLines.map((l, i) => {
      const p = readPiece(l + ' ' + shared.replace(/\d+/g, ' '));
      const own = readPiece(l);
      p.price = own.price; p.size_value = own.size_value || p.size_value; p.size_label = own.size_label || p.size_label;
      p.seller_code = own.seller_code; p.photo_index = Math.min(i, Math.max(0, (photoCount || 1) - 1));
      p.condition = own.condition || p.condition;
      return p;
    });
  } else {
    const p = readPiece(text);
    p.photo_index = null;
    pieces = [p];
  }
  const anyCat = pieces.some((p) => p.category !== 'other');
  const anyPrice = pieces.some((p) => p.price);
  const anySize = pieces.some((p) => p.size_value || p.size_label);
  const announcement = /\b(new bale|bale opening|opening|giveaway|closed|holiday|restock|coming soon)\b/i.test(text) && !anyPrice;
  const is_product = !announcement && (anyCat || (anyPrice && anySize));
  return { is_product, sold, pieces: is_product ? pieces : [] };
}

module.exports = { readCaption, readPiece, findPrice, findSize };
