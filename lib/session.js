// Signed sign-in cookie for sellers and admins. Buyers don't sign in in the pilot.
const crypto = require('crypto');
const { cookies, HttpError } = require('./http');
const { one } = require('./db');

const COOKIE = 'kb_session';
const DAYS = 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL) throw new HttpError(500, 'SESSION_SECRET is not set');
  return 'local-dev-secret-not-for-production';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function makeCookie(shopId) {
  const exp = Date.now() + DAYS * 86400000;
  const v = shopId + '.' + exp;
  const token = v + '.' + sign(v);
  return COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + DAYS * 86400 + (process.env.VERCEL ? '; Secure' : '');
}

function clearCookie() {
  return COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

function readShopId(req) {
  const t = cookies(req)[COOKIE];
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length !== 3) return null;
  const v = parts[0] + '.' + parts[1];
  const expected = sign(v);
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(parts[1]) < Date.now()) return null;
  return Number(parts[0]);
}

function adminNames() {
  return (process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
}

async function currentShop(req) {
  const id = readShopId(req);
  if (!id) return null;
  return one('SELECT * FROM shops WHERE id = $1', [id]);
}

async function requireShop(req) {
  const shop = await currentShop(req);
  if (!shop) throw new HttpError(401, 'Please sign in with Instagram.');
  return shop;
}

async function requireAdmin(req) {
  const shop = await requireShop(req);
  if (!isAdmin(shop)) throw new HttpError(403, 'Only Kabati admins can do this.');
  return shop;
}

function isAdmin(shop) {
  if (!shop) return false;
  if (!process.env.VERCEL && process.env.LOCAL_ADMIN === '1') return true;
  return adminNames().includes(String(shop.username).toLowerCase());
}

module.exports = { makeCookie, clearCookie, currentShop, requireShop, requireAdmin, isAdmin };
