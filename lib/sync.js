// Brings a shop's Instagram posts into Kabati as listings.
const ig = require('./ig');
const ai = require('./ai');
const photos = require('./photos');
const { q, one } = require('./db');

const DAYS_BACK = 90;
const PER_RUN = Number(process.env.SYNC_PER_RUN || 8);

function photoUrls(post) {
  if (post.media_type === 'CAROUSEL_ALBUM' && post.children && post.children.data) {
    return post.children.data.map((c) => (c.media_type === 'VIDEO' ? c.thumbnail_url : c.media_url)).filter(Boolean).slice(0, 6);
  }
  if (post.media_type === 'VIDEO') return [post.thumbnail_url].filter(Boolean);
  return [post.media_url].filter(Boolean);
}

async function freshToken(shop) {
  if (!shop.access_token) throw new Error('This shop is not connected to Instagram.');
  const exp = shop.token_expires ? new Date(shop.token_expires).getTime() : 0;
  if (exp && exp - Date.now() < 10 * 86400000) {
    try {
      const r = await ig.refresh(shop.access_token);
      await q('UPDATE shops SET access_token=$1, token_expires=$2 WHERE id=$3', [r.access_token, new Date(Date.now() + (r.expires_in || 5184000) * 1000).toISOString(), shop.id]);
      return r.access_token;
    } catch (e) { console.error('Token refresh failed for', shop.username, e.message); }
  }
  return shop.access_token;
}

async function nextCode(shop) {
  const r = await one('UPDATE shops SET next_number = next_number + 1 WHERE id=$1 RETURNING next_number - 1 AS n, code', [shop.id]);
  return (r.code || 'KB') + r.n;
}

async function liveListings(shopId) {
  return q("SELECT id, ig_media_id, hashes, price, code, status, category, last_seen_at FROM listings WHERE shop_id=$1 AND status IN ('live','check')", [shopId]);
}

const SAME = 6;   // at or under: the same photo posted again, merge automatically
const MAYBE = 20; // up to: could be the same piece, ask the seller
function bestMatch(hashes, listings, ownMedia, category) {
  let best = { d: 100, listing: null };
  for (const l of listings) {
    if (l.ig_media_id === ownMedia) continue;
    if (category && l.category && category !== 'other' && l.category !== 'other' && l.category !== category) continue;
    for (const a of hashes) for (const b of (l.hashes || [])) {
      const d = photos.distance(a, b);
      if (d < best.d) best = { d, listing: l };
    }
  }
  return best;
}

async function addCheck(shopId, listingId, kind, question, payload) {
  await q('INSERT INTO checks (shop_id, listing_id, kind, question, payload) VALUES ($1,$2,$3,$4,$5)', [shopId, listingId, kind, question, JSON.stringify(payload || {})]);
}

async function processPost(shop, post) {
  const urls = photoUrls(post);
  if (!urls.length) return 'no-photos';
  const prepared = [];
  for (const u of urls) {
    try { prepared.push(await photos.prepare(await ig.download(u))); } catch (e) { console.error('photo failed', e.message); }
  }
  if (!prepared.length) return 'no-photos';
  const read = await ai.readPost({ caption: post.caption || '', images: prepared.map((p) => p.small) });
  const existing = await q('SELECT * FROM listings WHERE ig_media_id=$1 ORDER BY piece_index', [post.id]);

  if (read.sold) {
    if (existing.length) {
      await q("UPDATE listings SET status='sold', sold_at=now(), updated_at=now() WHERE ig_media_id=$1 AND status<>'sold'", [post.id]);
      return 'sold';
    }
    const m = bestMatch(prepared.map((p) => p.hash), await liveListings(shop.id), post.id);
    if (m.listing && m.d <= SAME) {
      await q("UPDATE listings SET status='sold', sold_at=now(), updated_at=now() WHERE id=$1", [m.listing.id]);
      return 'sold';
    }
    return 'skip';
  }
  if (!read.is_product) return 'skip';

  const live = await liveListings(shop.id);
  let added = 0, repeats = 0;
  for (let i = 0; i < read.pieces.length; i++) {
    const p = read.pieces[i];
    const own = read.pieces.length > 1 && p.photo_index != null && prepared[p.photo_index] ? [prepared[p.photo_index]] : prepared;
    const hashes = own.map((x) => x.hash);
    const quality = read.photo_quality === 'low' || own.every((x) => x.quality === 'low') ? 'low' : 'ok';

    // Caption edited on a post we already have: update in place.
    const same = existing.filter((l) => l.piece_index === i)[0];
    if (same) {
      await q('UPDATE listings SET name=$1, category=$2, subtype=$3, size_value=$4, size_label=$5, price=COALESCE($6, price), condition=$7, fabric=$8, measurements=$9, caption=$10, updated_at=now() WHERE id=$11',
        [p.name, p.category, p.subtype, p.size_value, p.size_label, p.price, p.condition, p.fabric, JSON.stringify(p.measurements || []), post.caption || '', same.id]);
      continue;
    }

    // Repeat of a piece already listed from another post?
    const m = bestMatch(hashes, live, post.id, p.category);
    const sameCode = p.seller_code ? live.filter((l) => l.code === String(p.seller_code))[0] : null;
    const repeatOf = (m.listing && m.d <= SAME) ? m.listing : sameCode;
    if (repeatOf) {
      // Only a newer post may change the price; an older one just confirms the piece is still around.
      const when = post.timestamp || new Date().toISOString();
      await q('UPDATE listings SET price = CASE WHEN $1::int IS NOT NULL AND $2::timestamptz > last_seen_at THEN $1::int ELSE price END, last_seen_at = GREATEST(last_seen_at, $2::timestamptz), updated_at=now() WHERE id=$3', [p.price, when, repeatOf.id]);
      repeats++;
      continue;
    }

    let code = null;
    if (p.seller_code && !live.some((l) => l.code === String(p.seller_code))) code = String(p.seller_code);
    if (!code) code = await nextCode(shop);

    const stored = [];
    for (let k = 0; k < own.length; k++) stored.push(await photos.store('listings/' + shop.id + '/' + post.id + '-' + i + '-' + k + '.jpg', own[k].full));

    const status = p.category === 'other' ? 'check' : 'live';
    const row = await one(
      `INSERT INTO listings (shop_id, ig_media_id, piece_index, code, seller_code, name, category, subtype, gender, size_value, size_label, price, condition, fabric, measurements, photos, hashes, is_video, permalink, caption, posted_at, status, quality)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       ON CONFLICT (ig_media_id, piece_index) DO NOTHING RETURNING id`,
      [shop.id, post.id, i, code, p.seller_code, p.name, p.category, p.subtype, p.gender, p.size_value, p.size_label, p.price, p.condition, p.fabric,
        JSON.stringify(p.measurements || []), JSON.stringify(stored), JSON.stringify(hashes), post.media_type === 'VIDEO' || (post.media_type === 'CAROUSEL_ALBUM' && (post.children && post.children.data || []).some((c) => c.media_type === 'VIDEO')),
        post.permalink || null, post.caption || '', post.timestamp || new Date().toISOString(), status, quality]);
    await q('UPDATE listings SET last_seen_at=posted_at WHERE id=$1', [row ? row.id : 0]);
    if (!row) continue;
    added++;
    live.push({ id: row.id, ig_media_id: post.id, hashes, price: p.price, code, status, category: p.category, last_seen_at: post.timestamp });

    const u = p.unsure || [];
    if (m.listing && m.d <= MAYBE) await addCheck(shop.id, row.id, 'same', 'Is this the same piece as #' + m.listing.code + '?', { other: m.listing.id });
    if (u.includes('price_or_code') && p.price_numbers) await addCheck(shop.id, row.id, 'price', 'Which number is the price of “' + p.name + '”?', { options: p.price_numbers });
    else if (!p.price || u.includes('price')) await addCheck(shop.id, row.id, 'details', 'Add a price for “' + p.name + '”.', { need: ['price'] });
    if ((!p.size_value && !p.size_label && !['home', 'bag', 'other'].includes(p.category)) || u.includes('size')) await addCheck(shop.id, row.id, 'details', 'Add a size for “' + p.name + '”.', { need: ['size'] });
    if (p.category === 'other') await addCheck(shop.id, row.id, 'details', 'What kind of piece is this?', { need: ['category'] });
  }
  return added ? 'added' : (repeats ? 'repeat' : 'skip');
}

async function syncShop(shop, opts) {
  const limit = (opts && opts.limit) || PER_RUN;
  const token = await freshToken(shop);
  const since = Date.now() - DAYS_BACK * 86400000;
  const result = { added: 0, repeat: 0, skip: 0, sold: 0, errors: 0, remaining: 0 };
  let after = null, processed = 0, pages = 0;
  outer: while (pages < 6) {
    const page = await ig.media(token, after);
    pages++;
    for (const post of page.data || []) {
      if (post.timestamp && new Date(post.timestamp).getTime() < since) break outer;
      const seen = await one('SELECT caption, result FROM seen_media WHERE ig_media_id=$1', [post.id]);
      if (seen && (seen.caption || '') === (post.caption || '')) continue;
      if (processed >= limit) { result.remaining++; continue; }
      processed++;
      let r;
      try { r = await processPost(shop, post); } catch (e) { console.error('post failed', post.id, e); r = 'error'; result.errors++; }
      if (r !== 'error') {
        result[r === 'added' ? 'added' : r === 'repeat' ? 'repeat' : r === 'sold' ? 'sold' : 'skip']++;
        await q(`INSERT INTO seen_media (ig_media_id, shop_id, caption, result, updated_at) VALUES ($1,$2,$3,$4,now())
                 ON CONFLICT (ig_media_id) DO UPDATE SET caption=EXCLUDED.caption, result=EXCLUDED.result, updated_at=now()`, [post.id, shop.id, post.caption || '', r]);
      }
    }
    after = page.paging && page.paging.cursors && page.paging.next ? page.paging.cursors.after : null;
    if (!after) break;
  }
  await q('UPDATE shops SET last_synced_at=now() WHERE id=$1', [shop.id]);
  return result;
}

// Daily tidy-up: unsold pieces not seen again for 90 days leave the feed.
async function tidy() {
  await q("UPDATE listings SET status='hidden', updated_at=now() WHERE status='live' AND last_seen_at < now() - interval '90 days'");
}

module.exports = { syncShop, tidy, processPost };
