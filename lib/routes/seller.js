// Everything a signed-in seller does.
const { q, one } = require('../db');
const { HttpError, randomCode, baseUrl } = require('../http');
const { listingOut, shopOut, LISTING_SELECT } = require('../shape');
const { syncShop } = require('../sync');

const CATS = ['dress', 'top', 'bottom', 'outer', 'shoes', 'bag', 'home', 'other'];

async function makeShopCode(username) {
  const parts = username.replace(/[^a-z0-9_.]/gi, '').split(/[_.]+/).filter(Boolean);
  let base = parts.length > 1 ? parts.map((p) => p[0]).join('').slice(0, 3) : username.slice(0, 2);
  base = base.toUpperCase().replace(/[^A-Z]/g, 'K') || 'KB';
  let code = base, i = 0;
  while (await one('SELECT 1 FROM shops WHERE code=$1', [code])) { i++; code = base + String.fromCharCode(64 + ((i % 26) || 26)); }
  return code;
}

async function dashboard(shop, req) {
  const id = shop.id;
  const [counts, wants, taps, sales, insightsPrice, insightsSize, checks, missed] = await Promise.all([
    one("SELECT count(*) FILTER (WHERE status='live')::int AS live, count(*) FILTER (WHERE status='check')::int AS checking, count(*) FILTER (WHERE status='sold')::int AS sold FROM listings WHERE shop_id=$1", [id]),
    one("SELECT count(*)::int AS n, count(DISTINCT r.listing_id)::int AS pieces FROM reactions r JOIN listings l ON l.id=r.listing_id WHERE l.shop_id=$1 AND r.kind='want'", [id]),
    one("SELECT count(*) FILTER (WHERE channel='ig')::int AS ig, count(*) FILTER (WHERE channel='wa')::int AS wa FROM contacts WHERE shop_id=$1 AND created_at > now() - interval '7 days'", [id]),
    one('SELECT count(*)::int AS n FROM links WHERE shop_id=$1 AND claimed_at IS NOT NULL', [id]),
    q("SELECT l.id, l.code, l.name, l.price, count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY r.offer) AS median FROM reactions r JOIN listings l ON l.id=r.listing_id WHERE l.shop_id=$1 AND r.kind='price' AND l.status='live' GROUP BY l.id ORDER BY n DESC LIMIT 3", [id]),
    q("SELECT r.buyer_size AS size, count(*)::int AS n FROM reactions r JOIN listings l ON l.id=r.listing_id WHERE l.shop_id=$1 AND r.kind='size' AND r.buyer_size IS NOT NULL GROUP BY r.buyer_size ORDER BY n DESC LIMIT 3", [id]),
    q("SELECT c.*, l.name, l.code, l.photos, l.price, l.size_label, l.category FROM checks c LEFT JOIN listings l ON l.id=c.listing_id WHERE c.shop_id=$1 AND c.status='open' ORDER BY c.created_at DESC LIMIT 30", [id]),
    q("SELECT l.name, l.code, count(*)::int AS n FROM reactions r JOIN listings l ON l.id=r.listing_id WHERE l.shop_id=$1 AND l.status='sold' AND r.kind IN ('want','missed') GROUP BY l.id ORDER BY l.sold_at DESC LIMIT 1", [id]),
  ]);
  const s = shopOut(shop, { sales: sales.n });
  return {
    shop: Object.assign(s, { onboarded: shop.onboarded, whatsapp_number: shop.whatsapp, last_synced_at: shop.last_synced_at, bio_link: baseUrl(req) + '/s/' + shop.username }),
    counts, wants, taps, sales: sales.n,
    insights: {
      pricey: insightsPrice.map((r) => ({ id: r.id, code: r.code, name: r.name, price: r.price, n: r.n, median: r.median ? Math.round(Number(r.median) / 50) * 50 : null })),
      sizes: insightsSize,
      missed: missed[0] || null,
    },
    checks: checks.map((c) => ({ id: c.id, kind: c.kind, question: c.question, payload: c.payload, listing: c.listing_id ? { id: c.listing_id, name: c.name, code: c.code, photo: (c.photos || [])[0], price: c.price, size_label: c.size_label, category: c.category } : null })),
  };
}

async function updateProfile(shop, body) {
  const f = {};
  if (body.location !== undefined) f.location = String(body.location || '').slice(0, 200);
  if (body.area !== undefined) f.area = String(body.area || '').slice(0, 60) || 'Online only';
  if (body.hours !== undefined) f.hours = String(body.hours || '').slice(0, 120);
  if (body.has_stall !== undefined) f.has_stall = !!body.has_stall;
  if (body.order_ig !== undefined) f.order_ig = !!body.order_ig;
  if (body.order_wa !== undefined) f.order_wa = !!body.order_wa;
  if (body.whatsapp !== undefined) {
    let w = String(body.whatsapp || '').replace(/[^0-9]/g, '');
    if (w.startsWith('0')) w = '254' + w.slice(1);
    if (w && !/^254\d{9}$/.test(w)) throw new HttpError(400, 'Enter a Kenyan WhatsApp number, like 0712 345 678.');
    f.whatsapp = w || null;
  }
  if (body.delivery !== undefined) {
    if (!Array.isArray(body.delivery)) throw new HttpError(400, 'Delivery must be a list.');
    f.delivery = JSON.stringify(body.delivery.filter((d) => Array.isArray(d) && d[0]).slice(0, 8).map((d) => [String(d[0]).slice(0, 80), String(d[1] || '').slice(0, 160)]));
  }
  if (body.onboarded) f.onboarded = true;
  if (f.order_wa && !(f.whatsapp || shop.whatsapp)) throw new HttpError(400, 'Add your WhatsApp number to take orders there.');
  const keys = Object.keys(f);
  if (!keys.length) return { ok: true };
  await q('UPDATE shops SET ' + keys.map((k, i) => k + '=$' + (i + 1)).join(', ') + ' WHERE id=$' + (keys.length + 1), keys.map((k) => f[k]).concat([shop.id]));
  return { ok: true };
}

async function sync(shop) {
  return syncShop(shop, { limit: 8 });
}

async function listings(shop, query) {
  const st = ['live', 'sold', 'hidden', 'check'].includes(query.status) ? query.status : null;
  const rows = await q(LISTING_SELECT + ' WHERE l.shop_id=$1' + (st ? ' AND l.status=$2' : " AND l.status <> 'hidden'") + ' ORDER BY l.posted_at DESC LIMIT 300', st ? [shop.id, st] : [shop.id]);
  return { items: rows.map(listingOut) };
}

async function editListing(shop, id, body) {
  const l = await one('SELECT * FROM listings WHERE id=$1 AND shop_id=$2', [Number(id), shop.id]);
  if (!l) throw new HttpError(404, 'Piece not found.');
  const f = {};
  if (body.name !== undefined) f.name = String(body.name).slice(0, 80) || l.name;
  if (body.price !== undefined) {
    const p = body.price === null || body.price === '' ? null : Math.round(Number(String(body.price).replace(/[^0-9.]/g, '')));
    if (p !== null && !(p > 0)) throw new HttpError(400, 'Enter a price in shillings.');
    f.price = p;
  }
  if (body.size !== undefined) {
    const s = String(body.size || '').trim().toUpperCase();
    f.size_value = s ? s.replace(/^UK\s*/, '') : null;
    f.size_label = s || null;
  }
  if (body.category !== undefined) {
    if (!CATS.includes(body.category)) throw new HttpError(400, 'Unknown category.');
    f.category = body.category;
  }
  if (body.subtype !== undefined) f.subtype = body.subtype || null;
  if (body.gender !== undefined && ['w', 'm', 'u'].includes(body.gender)) f.gender = body.gender;
  if (body.status !== undefined) {
    if (!['live', 'sold', 'hidden'].includes(body.status)) throw new HttpError(400, 'Unknown status.');
    f.status = body.status;
    if (body.status === 'sold') f.sold_at = new Date().toISOString();
    if (body.status === 'live') f.last_seen_at = new Date().toISOString();
  }
  if (l.status === 'check' && body.status === undefined && (f.category || l.category) !== 'other') f.status = 'live';
  const keys = Object.keys(f);
  if (keys.length) await q('UPDATE listings SET ' + keys.map((k, i) => k + '=$' + (i + 1)).join(', ') + ', updated_at=now() WHERE id=$' + (keys.length + 1), keys.map((k) => f[k]).concat([l.id]));
  if (f.price !== undefined && f.price) await q("UPDATE checks SET status='done' WHERE listing_id=$1 AND (kind='price' OR question LIKE 'Add a price%')", [l.id]);
  if (f.size_value) await q("UPDATE checks SET status='done' WHERE listing_id=$1 AND question LIKE 'Add a size%'", [l.id]);
  if (f.category) await q("UPDATE checks SET status='done' WHERE listing_id=$1 AND question LIKE 'What kind%'", [l.id]);
  return { ok: true };
}

async function answerCheck(shop, id, body) {
  const c = await one('SELECT * FROM checks WHERE id=$1 AND shop_id=$2', [Number(id), shop.id]);
  if (!c) throw new HttpError(404, 'Check not found.');
  if (c.kind === 'same') {
    if (body.answer === 'same') {
      await q("UPDATE listings SET status='hidden', updated_at=now() WHERE id=$1", [c.listing_id]);
      await q("UPDATE listings SET last_seen_at=now() WHERE id=$1", [c.payload.other]);
    } else {
      await q("UPDATE listings SET status='live' WHERE id=$1 AND status='check'", [c.listing_id]);
    }
  } else if (c.kind === 'price') {
    const p = Math.round(Number(body.price));
    if (!(p > 0)) throw new HttpError(400, 'Pick the price.');
    await q('UPDATE listings SET price=$1, updated_at=now() WHERE id=$2', [p, c.listing_id]);
    if (body.code) await q('UPDATE listings SET seller_code=$1 WHERE id=$2', [String(body.code), c.listing_id]);
  } else if (c.kind === 'details') {
    await editListing(shop, c.listing_id, body);
  }
  await q("UPDATE checks SET status='done' WHERE id=$1", [c.id]);
  return { ok: true };
}

async function createLink(shop, body, req) {
  const ids = (body.listing_ids || []).map(Number).filter(Boolean).slice(0, 20);
  if (!ids.length) throw new HttpError(400, 'Pick at least one piece.');
  const rows = await q("SELECT id, name, code FROM listings WHERE shop_id=$1 AND id = ANY($2) AND status IN ('live','check')", [shop.id, ids]);
  if (rows.length !== ids.length) throw new HttpError(400, 'Some of those pieces are already sold or not yours.');
  let code;
  for (let i = 0; i < 5; i++) { code = randomCode(6); if (!(await one('SELECT 1 FROM links WHERE code=$1', [code]))) break; }
  await q('INSERT INTO links (code, shop_id, listing_ids) VALUES ($1,$2,$3)', [code, shop.id, JSON.stringify(ids)]);
  const url = baseUrl(req) + '/p/' + code;
  const what = rows.length === 1 ? 'your ' + rows[0].name.toLowerCase() + ' (#' + rows[0].code + ')' : 'your ' + rows.length + ' pieces (' + rows.map((r) => '#' + r.code).join(', ') + ')';
  return { code, url, message: 'Thanks for buying! Save ' + what + ' to your Kabati orders and track delivery here: ' + url };
}

async function sellerOrders(shop) {
  const rows = await q('SELECT * FROM orders WHERE shop_id=$1 ORDER BY created_at DESC LIMIT 100', [shop.id]);
  const links = await q('SELECT code, listing_ids, created_at FROM links WHERE shop_id=$1 AND claimed_at IS NULL AND created_at > now() - interval \'14 days\' ORDER BY created_at DESC', [shop.id]);
  return {
    orders: rows.map((o) => ({ id: o.id, buyer: o.person && o.person !== 'me' ? 'buyer (for ' + o.person + ')' : 'buyer', items: o.items, total: o.total, method: o.method, status: o.status, details: o.details, log: o.log, issue: o.issue, created_at: o.created_at, link: o.link_code })),
    waiting: links.map((k) => ({ code: k.code, count: (k.listing_ids || []).length, created_at: k.created_at })),
  };
}

async function updateOrder(shop, id, body) {
  const o = await one('SELECT * FROM orders WHERE id=$1 AND shop_id=$2', [Number(id), shop.id]);
  if (!o) throw new HttpError(404, 'Order not found.');
  const next = String(body.status || '');
  const allowed = { paid: ['packing'], packing: ['onway', 'ready'], onway: ['delivered'], ready: ['delivered'], delivered: [], done: [], issue: ['packing', 'onway', 'ready', 'delivered'] };
  if (!body.late && !(allowed[o.status] || []).includes(next)) throw new HttpError(400, 'That step doesn’t fit this order right now.');
  const log = o.log || {};
  let details = o.details;
  let method = o.method;
  if (body.late) {
    details = Object.assign({}, details || {}, { eta: String(body.eta || 'later today (running late)').slice(0, 80), late: true });
    await q('UPDATE orders SET details=$1 WHERE id=$2', [JSON.stringify(details), o.id]);
    return { ok: true };
  }
  if (next === 'onway' || next === 'ready') {
    const d = body.details || {};
    const type = ['rider', 'courier', 'bus', 'pickup'].includes(d.type) ? d.type : (next === 'ready' ? 'pickup' : 'rider');
    const clean = (v, n) => String(v || '').slice(0, n || 80);
    details = { type };
    if (type === 'rider') { if (!d.name || !d.eta) throw new HttpError(400, 'Add the rider’s name and when they’ll arrive.'); Object.assign(details, { name: clean(d.name), phone: clean(d.phone, 20), plate: clean(d.plate, 20), eta: clean(d.eta) }); }
    if (type === 'courier') { if (!d.company || !d.waybill) throw new HttpError(400, 'Add the courier and tracking number.'); Object.assign(details, { company: clean(d.company), waybill: clean(d.waybill, 40), eta: clean(d.eta) }); }
    if (type === 'bus') { if (!d.company || !d.waybill) throw new HttpError(400, 'Add the company and parcel number.'); Object.assign(details, { company: clean(d.company), route: clean(d.route), waybill: clean(d.waybill, 40), place: clean(d.place) }); }
    if (type === 'pickup') Object.assign(details, { place: clean(d.place || shop.location), hours: clean(d.hours || shop.hours), code: 'PK-' + randomCode(4) });
    method = type === 'pickup' ? 'pickup' : 'delivery';
  }
  log[next] = new Date().toISOString();
  await q('UPDATE orders SET status=$1, details=$2, method=$3, log=$4 WHERE id=$5', [next, details ? JSON.stringify(details) : null, method, JSON.stringify(log), o.id]);
  return { ok: true };
}

module.exports = { makeShopCode, dashboard, updateProfile, sync, listings, editListing, answerCheck, createLink, sellerOrders, updateOrder };
