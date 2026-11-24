// Sample shops so the app isn't empty before real sellers join. Admin can add or remove them.
const { q, one } = require('./db');
const photos = require('./photos');
const fs = require('fs');
const path = require('path');

const SHOPS = [
  { username: 'sample_mtumba_queen', name: 'Mtumba Queen (sample)', code: 'MQ', area: 'Sawa Mall', location: 'Sawa Mall, 2nd floor, Shop 14, Moi Avenue, Nairobi CBD', hours: 'Mon–Sat, 9am–6pm', has_stall: true, order_ig: true, order_wa: true, whatsapp: '254700000001',
    delivery: [['Nairobi CBD · KSh 150', 'Rider, same day if you order before 3pm'], ['Rest of Nairobi · KSh 200–350', 'Rider, same day or next morning'], ['Outside Nairobi · KSh 300–450', 'Bus parcel, 1–2 days'], ['Pick up at the stall · free', 'Show your order code at Shop 14']] },
  { username: 'sample_denimhub', name: 'Denim Hub (sample)', code: 'DH', area: 'Sawa Mall', location: 'Sawa Mall, ground floor, Shop 3', hours: 'Mon–Sat, 9am–7pm', has_stall: true, order_ig: true, order_wa: false,
    delivery: [['Nairobi · KSh 250', 'Rider, same day']] },
  { username: 'sample_thrift_avenue', name: 'Thrift Avenue (sample)', code: 'TA', area: 'Kimathi Street', location: 'Kimathi House, 1st floor, Room 104, Kimathi Street', hours: 'Mon–Fri, 10am–6pm', has_stall: true, order_ig: true, order_wa: true, whatsapp: '254700000003',
    delivery: [['Nairobi · KSh 200', 'Rider, same day'], ['Pick up in CBD · free', 'At the shop']] },
  { username: 'sample_nyumba_finds', name: 'Nyumba Finds (sample)', code: 'NF', area: 'Online only', location: 'Online only, ships from Kilimani', has_stall: false, order_ig: true, order_wa: true, whatsapp: '254700000004',
    delivery: [['Nairobi · KSh 250', 'Rider, next day']] },
];

const ITEMS = [
  ['sample_mtumba_queen', 'Linen midi dress', 'dress', 'midi', 'w', '10', 900, 'linen-midi', null, '100% linen', [['Pit to pit', '48 cm'], ['Length', '112 cm']], 2],
  ['sample_mtumba_queen', 'Wide-leg trousers', 'bottom', 'trousers', 'w', '10', 950, 'wide-leg', 'Like new', 'Linen blend', [['Waist', '78 cm']], 30],
  ['sample_mtumba_queen', 'Satin blouse', 'top', null, 'w', '8', 650, 'satin-blouse', 'Mint condition', 'Satin', [], 10],
  ['sample_mtumba_queen', 'Linen shorts', 'bottom', 'shorts', 'w', '10', 450, 'linen-shorts', null, 'Linen', [], 16],
  ['sample_mtumba_queen', 'Denim mini dress', 'dress', 'mini', 'w', '10', 900, 'mini-dress', null, null, [], 9],
  ['sample_mtumba_queen', 'Kitenge wrap skirt', 'bottom', 'skirt', 'w', '14', 850, 'kitenge-skirt', 'Brand new', null, [], 11],
  ['sample_denimhub', 'Straight-leg jeans', 'bottom', 'jeans', 'w', '10', 1200, 'mom-jeans', 'Mint condition', 'Cotton denim', [['Waist', '82 cm'], ['Inseam', '76 cm']], 5],
  ['sample_denimhub', 'Cropped denim jacket', 'outer', null, 'w', '10', 1400, 'denim-jacket', null, 'Cotton denim', [], 26],
  ['sample_denimhub', 'Oxford button-down shirt', 'top', null, 'm', 'L', 900, 'oxford-shirt', 'Like new', 'Cotton oxford', [['Chest', '112 cm']], 3],
  ['sample_denimhub', 'Slim chinos', 'bottom', 'trousers', 'm', 'L', 1100, 'chinos', null, null, [], 8],
  ['sample_thrift_avenue', 'Wool tailored blazer', 'outer', null, 'w', '10', 1800, 'wool-blazer', null, 'Wool', [], 26],
  ['sample_thrift_avenue', 'Pleated maxi dress', 'dress', 'maxi', 'w', '10', 1100, 'pleated-maxi', null, null, [['Length', '135 cm']], 7],
  ['sample_thrift_avenue', 'Floral wrap dress', 'dress', 'midi', 'w', '12', 850, 'floral-wrap', null, 'Viscose', [], 4],
  ['sample_thrift_avenue', 'Wool overcoat', 'outer', null, 'm', 'L', 2500, 'overcoat', 'Mint condition', 'Wool blend', [], 14],
  ['sample_thrift_avenue', 'Silk camisole', 'top', null, 'w', '10', 600, 'silk-cami', 'Brand new with tags', 'Silk', [], 3],
  ['sample_nyumba_finds', 'Ceramic flower vase', 'home', null, 'u', null, 1500, 'ceramic-vase', 'Brand new', null, [['Height', '24 cm']], 6],
  ['sample_nyumba_finds', 'Woven throw pillow', 'home', null, 'u', null, 850, 'throw-pillow', 'Brand new', null, [['Size', '45 × 45 cm']], 9],
  ['sample_mtumba_queen', 'Cargo shorts', 'bottom', 'shorts', 'w', '12', 500, 'cargo-shorts', null, null, [], 40],
];

async function add() {
  const ids = {};
  for (const s of SHOPS) {
    const row = await one(`INSERT INTO shops (username, name, code, area, location, hours, has_stall, order_ig, order_wa, whatsapp, delivery, status, is_sample, onboarded, followers, ig_since, next_number)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',TRUE,TRUE,$12,$13,250) ON CONFLICT (username) DO UPDATE SET status='active' RETURNING id`,
      [s.username, s.name, s.code, s.area, s.location, s.hours || null, s.has_stall, s.order_ig, s.order_wa, s.whatsapp || null, JSON.stringify(s.delivery), 2000 + Math.floor(Math.random() * 6000), '2021']);
    ids[s.username] = row.id;
  }
  let n = 0;
  for (const it of ITEMS) {
    const [u, name, cat, sub, g, size, price, photo, cond, fabric, meas, hours] = it;
    const media = 'sample_' + photo;
    if (await one('SELECT 1 FROM listings WHERE ig_media_id=$1', [media])) continue;
    const urls = [];
    let hash = null;
    for (const v of ['', '-b']) {
      const buf = fs.readFileSync(path.join(__dirname, '..', 'public', 'demo', photo + v + '.jpg'));
      if (!hash) hash = await photos.dhash(buf);
      urls.push('/demo/' + photo + v + '.jpg');
    }
    const code = await one('UPDATE shops SET next_number=next_number+1 WHERE id=$1 RETURNING code, next_number-1 AS n', [ids[u]]);
    await q(`INSERT INTO listings (shop_id, ig_media_id, code, name, category, subtype, gender, size_value, size_label, price, condition, fabric, measurements, photos, hashes, posted_at, status, quality)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now() - ($16 || ' hours')::interval, 'live', 'ok')`,
      [ids[u], media, code.code + code.n, name, cat, sub, g, size, size, price, cond, fabric, JSON.stringify(meas), JSON.stringify(urls), JSON.stringify([hash]), String(hours)]);
    n++;
  }
  return { shops: SHOPS.length, listings: n };
}

async function remove() {
  await q('DELETE FROM orders WHERE shop_id IN (SELECT id FROM shops WHERE is_sample)');
  await q('DELETE FROM links WHERE shop_id IN (SELECT id FROM shops WHERE is_sample)');
  await q('DELETE FROM shops WHERE is_sample');
  return { ok: true };
}

module.exports = { add, remove };
