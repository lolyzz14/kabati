// Turns database rows into what the app shows.
function level(sales) {
  if (sales >= 40) return 'Top shop';
  if (sales >= 15) return 'Trusted';
  if (sales >= 3) return 'Rising';
  return 'New shop';
}

function shopOut(s, extra) {
  if (!s) return null;
  const sales = Number((extra && extra.sales) || s.sales || 0);
  return {
    username: s.username,
    handle: '@' + s.username,
    name: s.name,
    code: s.code,
    area: s.area || 'Online only',
    location: s.location || null,
    hours: s.hours || null,
    delivery: s.delivery || [],
    order_ig: !!s.order_ig,
    order_wa: !!s.order_wa && !!s.whatsapp,
    whatsapp: s.order_wa ? s.whatsapp : null,
    has_stall: !!s.has_stall,
    followers: s.followers,
    ig_since: s.ig_since,
    joined: s.created_at,
    sales,
    back: Number((extra && extra.back) || s.back || 0),
    level: level(sales),
    status: s.status,
  };
}

function listingOut(l) {
  return {
    id: l.id,
    code: l.code,
    name: l.name,
    category: l.category,
    subtype: l.subtype,
    gender: l.gender,
    size_value: l.size_value,
    size_label: l.size_label,
    price: l.price,
    condition: l.condition,
    fabric: l.fabric,
    measurements: l.measurements || [],
    photos: l.photos || [],
    is_video: !!l.is_video,
    permalink: l.permalink,
    posted_at: l.posted_at,
    status: l.status,
    wants: Number(l.wants || 0),
    quality: l.quality,
    shop: l.username ? shopOut({ username: l.username, name: l.shop_name, code: l.shop_code, area: l.area, location: l.location, hours: l.hours, delivery: l.delivery, order_ig: l.order_ig, order_wa: l.order_wa, whatsapp: l.whatsapp, has_stall: l.has_stall, followers: l.followers, ig_since: l.ig_since, created_at: l.shop_created, status: l.shop_status, sales: l.shop_sales }) : undefined,
  };
}

const LISTING_SELECT = `
  SELECT l.*, s.username, s.name AS shop_name, s.code AS shop_code, s.area, s.location, s.hours, s.delivery, s.order_ig, s.order_wa, s.whatsapp,
         s.has_stall, s.followers, s.ig_since, s.created_at AS shop_created, s.status AS shop_status,
         (SELECT count(*) FROM reactions r WHERE r.listing_id = l.id AND r.kind = 'want') AS wants,
         (SELECT count(*) FROM links k WHERE k.shop_id = s.id AND k.claimed_at IS NOT NULL) AS shop_sales
  FROM listings l JOIN shops s ON s.id = l.shop_id`;

module.exports = { level, shopOut, listingOut, LISTING_SELECT };
