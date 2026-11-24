// Everything a buyer does. Buyers don't sign in: the app keeps a random device id instead.
const { q, one } = require('../db');
const { HttpError, randomCode } = require('../http');
const { listingOut, shopOut, LISTING_SELECT } = require('../shape');

const CATS = ['dress', 'top', 'bottom', 'outer', 'shoes', 'bag', 'home', 'other'];
const okBuyer = (b) => typeof b === 'string' && /^d_[a-z0-9]{8,32}:[a-z0-9_-]{1,32}$/i.test(b);
const okDevice = (d) => typeof d === 'string' && /^d_[a-z0-9]{8,32}$/i.test(d);

function interleave(rows, max) {
  const out = [], wait = [];
  let last = null, run = 0;
  const pool = rows.slice();
  while (pool.length || wait.length) {
    let idx = pool.findIndex((r) => !(r.shop_id === last && run >= max));
    let r;
    if (idx >= 0) r = pool.splice(idx, 1)[0];
    else if (pool.length) r = pool.shift();
    else r = wait.shift();
    if (!r) break;
    if (r.shop_id === last) run++; else { last = r.shop_id; run = 1; }
    out.push(r);
  }
  return out;
}

async function feed(query) {
  const where = ["l.status = 'live'", "s.status = 'active'"];
  const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replace('?', '$' + p.length)); };
  if (query.ids) {
    const ids = String(query.ids).split(',').map(Number).filter(Boolean).slice(0, 100);
    if (!ids.length) return { items: [] };
    where.length = 0; where.push("s.status = 'active'");
    p.push(ids); where.push('l.id = ANY($' + p.length + ')');
  } else {
    if (query.cat === 'home') where.push("l.category = 'home'");
    else if (query.cat && CATS.includes(query.cat)) add('l.category = ?', query.cat);
    if (query.sub) add('l.subtype = ?', String(query.sub));
    if (query.gender === 'm') where.push("(l.gender IN ('m','u') OR l.category = 'home')");
    else if (query.gender === 'w') where.push("(l.gender IN ('w','u') OR l.category = 'home')");
    if (query.size) add("(l.size_value = ? OR l.size_value IS NULL AND l.category IN ('home','bag'))", String(query.size).toUpperCase());
    if (query.max) add('l.price < ?', Number(query.max));
    if (query.area) add('s.area = ?', String(query.area));
    if (query.via === 'ig') where.push('s.order_ig');
    if (query.via === 'wa') where.push("s.order_wa AND s.whatsapp IS NOT NULL AND s.whatsapp <> ''");
    if (query.shop) add('s.username = ?', String(query.shop).replace(/^@/, '').toLowerCase());
    if (query.q) { p.push('%' + String(query.q).replace(/^#/, '').toLowerCase() + '%'); where.push('(lower(l.name) LIKE $' + p.length + ' OR lower(l.code) LIKE $' + p.length + ' OR lower(s.username) LIKE $' + p.length + ' OR lower(coalesce(l.fabric,\'\')) LIKE $' + p.length + ')'); }
  }
  let order = "(l.quality = 'low') ASC, l.posted_at DESC";
  if (query.sort === 'low') order = 'l.price ASC NULLS LAST';
  if (query.sort === 'want') order = 'wants DESC, l.posted_at DESC';
  const rows = await q(LISTING_SELECT + ' WHERE ' + where.join(' AND ') + ' ORDER BY ' + order + ' LIMIT 200', p);
  const list = (query.sort && query.sort !== 'new') || query.ids ? rows : interleave(rows, 3);
  if (query.ids) {
    const ids = String(query.ids).split(',').map(Number);
    list.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }
  return { items: list.map(listingOut) };
}

async function meta() {
  const areas = await q("SELECT DISTINCT area FROM shops WHERE status='active' AND area IS NOT NULL AND area <> '' ORDER BY area");
  return { areas: areas.map((a) => a.area) };
}

async function shopPage(username) {
  const s = await one("SELECT * FROM shops WHERE username=$1 AND status='active'", [String(username).replace(/^@/, '').toLowerCase()]);
  if (!s) throw new HttpError(404, 'Shop not found.');
  const sales = await one('SELECT count(*)::int AS n FROM links WHERE shop_id=$1 AND claimed_at IS NOT NULL', [s.id]);
  const back = await one('SELECT count(*)::int AS n FROM (SELECT split_part(claimed_by, \':\', 1) d FROM links WHERE shop_id=$1 AND claimed_at IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x', [s.id]);
  const rows = await q(LISTING_SELECT + " WHERE l.shop_id=$1 AND l.status IN ('live','sold') AND (l.status='live' OR l.sold_at > now() - interval '30 days') ORDER BY l.posted_at DESC LIMIT 200", [s.id]);
  return { shop: shopOut(s, { sales: sales.n, back: back.n }), items: rows.map(listingOut) };
}

async function react(body) {
  if (!okBuyer(body.buyer)) throw new HttpError(400, 'Missing buyer id.');
  const id = Number(body.listing);
  if (!id) throw new HttpError(400, 'Missing piece.');
  if (!body.kind) { await q('DELETE FROM reactions WHERE buyer=$1 AND listing_id=$2', [body.buyer, id]); return { ok: true }; }
  if (!['want', 'size', 'price', 'missed'].includes(body.kind)) throw new HttpError(400, 'Unknown reaction.');
  const offer = body.offer ? Math.round(Number(body.offer)) || null : null;
  await q(`INSERT INTO reactions (buyer, listing_id, kind, buyer_size, offer) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (buyer, listing_id) DO UPDATE SET kind=EXCLUDED.kind, buyer_size=EXCLUDED.buyer_size, offer=EXCLUDED.offer, created_at=now()`,
    [body.buyer, id, body.kind, body.size ? String(body.size).slice(0, 8) : null, offer]);
  return { ok: true };
}

async function saved(query) {
  if (!okBuyer(query.buyer)) throw new HttpError(400, 'Missing buyer id.');
  const rows = await q('SELECT r.kind, r.offer, x.* FROM reactions r JOIN (' + LISTING_SELECT + ") x ON x.id = r.listing_id WHERE r.buyer=$1 AND x.shop_status='active' ORDER BY r.created_at DESC", [query.buyer]);
  return { items: rows.map((r) => Object.assign(listingOut(r), { reaction: r.kind, offer: r.offer })) };
}

async function contact(body) {
  const l = await one('SELECT id, shop_id FROM listings WHERE id=$1', [Number(body.listing)]);
  if (!l) throw new HttpError(404, 'Piece not found.');
  await q('INSERT INTO contacts (listing_id, shop_id, channel) VALUES ($1,$2,$3)', [l.id, l.shop_id, body.channel === 'wa' ? 'wa' : 'ig']);
  return { ok: true };
}

async function report(body) {
  const kind = ['sold', 'fake', 'other'].includes(body.kind) ? body.kind : 'other';
  let shopId = null, listingId = null;
  if (body.listing) { const l = await one('SELECT id, shop_id FROM listings WHERE id=$1', [Number(body.listing)]); if (l) { listingId = l.id; shopId = l.shop_id; } }
  if (body.shop) { const s = await one('SELECT id FROM shops WHERE username=$1', [String(body.shop).replace(/^@/, '')]); if (s) shopId = s.id; }
  await q('INSERT INTO reports (shop_id, listing_id, kind, note) VALUES ($1,$2,$3,$4)', [shopId, listingId, kind, body.note ? String(body.note).slice(0, 500) : null]);
  if (kind === 'sold' && listingId) {
    const n = await one("SELECT count(*)::int AS n FROM reports WHERE listing_id=$1 AND kind='sold' AND status='open'", [listingId]);
    if (n.n >= 2) await q("UPDATE listings SET status='check', updated_at=now() WHERE id=$1 AND status='live'", [listingId]);
  }
  return { ok: true };
}

async function linkInfo(code) {
  const k = await one('SELECT * FROM links WHERE code=$1', [String(code).toUpperCase()]);
  if (!k) throw new HttpError(404, 'This purchase link doesn’t exist. Check the code with the shop.');
  const s = await one('SELECT * FROM shops WHERE id=$1', [k.shop_id]);
  const rows = await q(LISTING_SELECT + ' WHERE l.id = ANY($1)', [k.listing_ids]);
  return { code: k.code, claimed: !!k.claimed_at, created_at: k.created_at, shop: shopOut(s), items: rows.map(listingOut) };
}

async function claim(code, body) {
  if (!okBuyer(body.buyer)) throw new HttpError(400, 'Missing buyer id.');
  const k = await one('SELECT * FROM links WHERE code=$1', [String(code).toUpperCase()]);
  if (!k) throw new HttpError(404, 'This purchase link doesn’t exist.');
  if (k.claimed_at) {
    if (k.claimed_by === body.buyer) return { ok: true, already: true };
    throw new HttpError(409, 'This link has already been used.');
  }
  if (Date.now() - new Date(k.created_at).getTime() > 14 * 86400000) throw new HttpError(410, 'This link has expired. Ask the shop for a new one.');
  const upd = await one('UPDATE links SET claimed_at=now(), claimed_by=$1 WHERE code=$2 AND claimed_at IS NULL RETURNING code', [body.buyer, k.code]);
  if (!upd) throw new HttpError(409, 'This link has already been used.');
  const items = await q('SELECT id, name, code, price, size_label, photos FROM listings WHERE id = ANY($1)', [k.listing_ids]);
  await q("UPDATE listings SET status='sold', sold_at=now(), updated_at=now() WHERE id = ANY($1)", [k.listing_ids]);
  const total = items.reduce((t, i) => t + (i.price || 0), 0);
  const now = new Date().toISOString();
  const order = await one('INSERT INTO orders (link_code, shop_id, buyer, person, items, total, status, log) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [k.code, k.shop_id, body.buyer, String(body.buyer).split(':')[1], JSON.stringify(items.map((i) => ({ id: i.id, name: i.name, code: i.code, price: i.price, size: i.size_label, photo: (i.photos || [])[0] || null }))), total, 'paid', JSON.stringify({ paid: now })]);
  return { ok: true, order: order.id };
}

async function orders(query) {
  if (!okDevice(query.device)) throw new HttpError(400, 'Missing device id.');
  const rows = await q('SELECT o.*, s.username, s.order_ig, s.order_wa, s.whatsapp FROM orders o JOIN shops s ON s.id=o.shop_id WHERE o.buyer LIKE $1 ORDER BY o.created_at DESC LIMIT 100', [query.device + ':%']);
  return { orders: rows.map((o) => ({ id: o.id, shop: '@' + o.username, shop_username: o.username, person: o.person, items: o.items, total: o.total, method: o.method, status: o.status, details: o.details, log: o.log, issue: o.issue, created_at: o.created_at, whatsapp: o.order_wa ? o.whatsapp : null })) };
}

async function orderAction(id, action, body) {
  if (!okDevice(body.device)) throw new HttpError(400, 'Missing device id.');
  const o = await one('SELECT * FROM orders WHERE id=$1 AND buyer LIKE $2', [Number(id), body.device + ':%']);
  if (!o) throw new HttpError(404, 'Order not found.');
  const log = o.log || {};
  if (action === 'done') {
    log.done = new Date().toISOString();
    await q("UPDATE orders SET status='done', log=$1 WHERE id=$2", [JSON.stringify(log), o.id]);
  } else if (action === 'issue') {
    log.issue = new Date().toISOString();
    await q("UPDATE orders SET status='issue', issue=$1, log=$2 WHERE id=$3", [String(body.issue || 'Something else').slice(0, 200), JSON.stringify(log), o.id]);
    await q("INSERT INTO reports (shop_id, kind, note) VALUES ($1,'order',$2)", [o.shop_id, 'Order ' + o.id + ': ' + String(body.issue || '')]);
  }
  return { ok: true };
}

module.exports = { feed, meta, shopPage, react, saved, contact, report, linkInfo, claim, orders, orderAction, randomCode };
