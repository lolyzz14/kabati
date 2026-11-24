// Kabati admin: approve shops, pause shops, see reports, sample shops.
const { q, one } = require('../db');
const { HttpError } = require('../http');
const { syncShop } = require('../sync');
const demo = require('../demo');

async function overview() {
  const shops = await q(`SELECT s.id, s.username, s.name, s.area, s.status, s.is_sample, s.followers, s.created_at, s.last_synced_at, s.account_type,
      (SELECT count(*)::int FROM listings l WHERE l.shop_id=s.id AND l.status='live') AS live,
      (SELECT count(*)::int FROM links k WHERE k.shop_id=s.id AND k.claimed_at IS NOT NULL) AS sales,
      (SELECT count(*)::int FROM reports r WHERE r.shop_id=s.id AND r.status='open') AS reports
    FROM shops s ORDER BY (s.status='pending') DESC, s.created_at DESC LIMIT 500`);
  const reports = await q(`SELECT r.*, s.username, l.name AS listing_name, l.code FROM reports r LEFT JOIN shops s ON s.id=r.shop_id LEFT JOIN listings l ON l.id=r.listing_id
    WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 100`);
  const totals = await one(`SELECT (SELECT count(*)::int FROM listings WHERE status='live') AS live, (SELECT count(*)::int FROM orders) AS orders,
      (SELECT count(*)::int FROM reactions WHERE kind='want') AS wants, (SELECT count(*)::int FROM links WHERE claimed_at IS NOT NULL) AS sales`);
  return { shops, reports, totals, hasSamples: shops.some((s) => s.is_sample) };
}

async function setShop(id, body) {
  if (!['active', 'paused', 'pending'].includes(body.status)) throw new HttpError(400, 'Unknown status.');
  const s = await one('UPDATE shops SET status=$1 WHERE id=$2 RETURNING id', [body.status, Number(id)]);
  if (!s) throw new HttpError(404, 'Shop not found.');
  return { ok: true };
}

async function closeReport(id) {
  await q("UPDATE reports SET status='closed' WHERE id=$1", [Number(id)]);
  return { ok: true };
}

async function samples(body) {
  return body.on ? demo.add() : demo.remove();
}

async function syncOne(id) {
  const s = await one('SELECT * FROM shops WHERE id=$1', [Number(id)]);
  if (!s) throw new HttpError(404, 'Shop not found.');
  if (s.is_sample) return { added: 0, note: 'Sample shops have no Instagram.' };
  return syncShop(s, { limit: 8 });
}

module.exports = { overview, setShop, closeReport, samples, syncOne };
