// The one server function behind every /api/... address (Vercel's free plan allows only a few functions).
const crypto = require('crypto');
const { migrate, q, one } = require('../lib/db');
const { readBody, send, redirect, cookies, baseUrl, HttpError } = require('../lib/http');
const session = require('../lib/session');
const ig = require('../lib/ig');
const buyer = require('../lib/routes/buyer');
const seller = require('../lib/routes/seller');
const admin = require('../lib/routes/admin');
const { syncShop, tidy } = require('../lib/sync');

function route(req) {
  const url = new URL(req.url, 'http://x');
  let p = url.searchParams.get('__p');
  if (p === null) p = url.pathname.replace(/^\/api\/?/, '');
  const query = Object.fromEntries(url.searchParams.entries());
  delete query.__p;
  return { parts: p.split('/').filter(Boolean), query };
}

async function handle(req, res) {
  await migrate();
  const { parts, query } = route(req);
  const m = req.method;
  const [a, b, c, d] = parts;
  const body = m === 'GET' ? {} : await readBody(req);

  // ---- sign in with Instagram
  if (a === 'auth' && b === 'instagram' && m === 'GET') {
    const state = crypto.randomBytes(12).toString('hex');
    return redirect(res, ig.authUrl(baseUrl(req) + '/api/auth/callback', state), { 'Set-Cookie': 'kb_state=' + state + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=600' });
  }
  if (a === 'auth' && b === 'callback' && m === 'GET') {
    if (query.error) return redirect(res, '/?signin=cancelled#sell');
    if (!query.code || !query.state || query.state !== cookies(req).kb_state) return redirect(res, '/?signin=failed#sell');
    try {
      const short = await ig.exchangeCode(query.code, baseUrl(req) + '/api/auth/callback');
      const long = await ig.longLived(short.access_token);
      const prof = await ig.profile(long.access_token);
      const igId = String(prof.user_id || prof.id || short.user_id);
      const username = String(prof.username).toLowerCase();
      const expires = new Date(Date.now() + (long.expires_in || 5184000) * 1000).toISOString();
      let shop = await one('SELECT * FROM shops WHERE ig_user_id=$1 OR username=$2', [igId, username]);
      if (shop) {
        await q('UPDATE shops SET ig_user_id=$1, username=$2, name=$3, access_token=$4, token_expires=$5, account_type=$6, followers=$7, photo_url=$8 WHERE id=$9',
          [igId, username, prof.name || username, long.access_token, expires, prof.account_type || null, prof.followers_count || null, prof.profile_picture_url || null, shop.id]);
      } else {
        const code = await seller.makeShopCode(username);
        const auto = process.env.AUTO_APPROVE === '1' || session.isAdmin({ username });
        shop = await one(`INSERT INTO shops (ig_user_id, username, name, code, access_token, token_expires, account_type, followers, photo_url, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [igId, username, prof.name || username, code, long.access_token, expires, prof.account_type || null, prof.followers_count || null, prof.profile_picture_url || null, auto ? 'active' : 'pending']);
      }
      return redirect(res, '/?signin=ok#sell', { 'Set-Cookie': [session.makeCookie(shop.id), 'kb_state=; Path=/; Max-Age=0'] });
    } catch (e) {
      console.error('Instagram sign-in failed:', e.message, e.ig || '');
      return redirect(res, '/?signin=failed&why=' + encodeURIComponent(e.message.slice(0, 120)) + '#sell');
    }
  }
  if (a === 'auth' && b === 'logout' && m === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': session.clearCookie() });

  // ---- who is signed in
  if (a === 'me' && m === 'GET') {
    const shop = await session.currentShop(req);
    return send(res, 200, { shop: shop ? { username: shop.username, status: shop.status, onboarded: shop.onboarded, is_admin: session.isAdmin(shop) } : null });
  }

  // ---- buyers
  if (a === 'meta' && m === 'GET') return send(res, 200, await buyer.meta());
  if (a === 'feed' && m === 'GET') return send(res, 200, await buyer.feed(query));
  if (a === 'shop' && b && m === 'GET') return send(res, 200, await buyer.shopPage(b));
  if (a === 'react' && m === 'POST') return send(res, 200, await buyer.react(body));
  if (a === 'saved' && m === 'GET') return send(res, 200, await buyer.saved(query));
  if (a === 'contact' && m === 'POST') return send(res, 200, await buyer.contact(body));
  if (a === 'report' && m === 'POST') return send(res, 200, await buyer.report(body));
  if (a === 'link' && b && !c && m === 'GET') return send(res, 200, await buyer.linkInfo(b));
  if (a === 'link' && b && c === 'claim' && m === 'POST') return send(res, 200, await buyer.claim(b, body));
  if (a === 'orders' && !b && m === 'GET') return send(res, 200, await buyer.orders(query));
  if (a === 'orders' && b && (c === 'done' || c === 'issue') && m === 'POST') return send(res, 200, await buyer.orderAction(b, c, body));

  // ---- sellers
  if (a === 'seller') {
    const shop = await session.requireShop(req);
    if (!b && m === 'GET') return send(res, 200, await seller.dashboard(shop, req));
    if (b === 'profile' && m === 'POST') return send(res, 200, await seller.updateProfile(shop, body));
    if (b === 'sync' && m === 'POST') return send(res, 200, await seller.sync(shop));
    if (b === 'listings' && !c && m === 'GET') return send(res, 200, await seller.listings(shop, query));
    if (b === 'listings' && c && m === 'POST') return send(res, 200, await seller.editListing(shop, c, body));
    if (b === 'checks' && c && m === 'POST') return send(res, 200, await seller.answerCheck(shop, c, body));
    if (b === 'links' && m === 'POST') return send(res, 200, await seller.createLink(shop, body, req));
    if (b === 'orders' && !c && m === 'GET') return send(res, 200, await seller.sellerOrders(shop));
    if (b === 'orders' && c && m === 'POST') return send(res, 200, await seller.updateOrder(shop, c, body));
  }

  // ---- admin
  if (a === 'admin') {
    await session.requireAdmin(req);
    if (!b && m === 'GET') return send(res, 200, await admin.overview());
    if (b === 'shops' && c && !d && m === 'POST') return send(res, 200, await admin.setShop(c, body));
    if (b === 'shops' && c && d === 'sync' && m === 'POST') return send(res, 200, await admin.syncOne(c));
    if (b === 'reports' && c && m === 'POST') return send(res, 200, await admin.closeReport(c));
    if (b === 'samples' && m === 'POST') return send(res, 200, await admin.samples(body));
  }

  // ---- scheduled sync (Vercel Cron calls this with the CRON_SECRET)
  if (a === 'cron' && b === 'sync') {
    const auth = req.headers.authorization || '';
    if (process.env.CRON_SECRET && auth !== 'Bearer ' + process.env.CRON_SECRET) throw new HttpError(401, 'Not allowed.');
    const started = Date.now();
    const shops = await q("SELECT * FROM shops WHERE status='active' AND NOT is_sample AND access_token IS NOT NULL ORDER BY last_synced_at ASC NULLS FIRST LIMIT 50");
    const done = [];
    for (const s of shops) {
      if (Date.now() - started > 45000) break;
      try { const r = await syncShop(s, { limit: 5 }); done.push([s.username, r.added]); } catch (e) { done.push([s.username, 'error: ' + e.message]); }
    }
    await tidy();
    return send(res, 200, { ok: true, synced: done });
  }

  throw new HttpError(404, 'Not found.');
}

module.exports = async (req, res) => {
  try {
    await handle(req, res);
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    if (status === 500) console.error(e);
    send(res, status, { error: status === 500 ? 'Something went wrong. Please try again.' : e.message });
  }
};

module.exports.config = { maxDuration: 60 };
