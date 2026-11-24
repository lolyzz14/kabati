/* Kabati web app. Plain JavaScript: state -> render() -> HTML. */
(function () {
'use strict';

/* ---------- helpers ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function pretty(iso) { if (!iso) return ''; var d = new Date(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ', ' + d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }); }
function day(iso) { if (!iso) return ''; var d = new Date(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
function ago(iso) { var h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000)); return h < 1 ? 'just now' : h < 24 ? (h === 1 ? '1 hr ago' : h + ' hrs ago') : h < 48 ? 'yesterday' : Math.floor(h / 24) + ' days ago'; }
function hoursOld(iso) { return (Date.now() - new Date(iso).getTime()) / 3600000; }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('kb_' + k)); localStorage.setItem('kb_' + k, JSON.stringify(v)); } catch (e) { return null; } }
function rid() { var a = 'abcdefghijklmnopqrstuvwxyz0123456789', s = ''; var r = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(r); for (var i = 0; i < 16; i++) s += a[r[i] % a.length]; return s; }

function api(path, opts) {
  opts = opts || {};
  var init = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin' };
  if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  return fetch('/api/' + path, init).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) { var e = new Error(d.error || 'Something went wrong.'); e.status = r.status; throw e; }
      return d;
    });
  });
}
function qs(o) { var p = []; Object.keys(o).forEach(function (k) { if (o[k] !== '' && o[k] != null && o[k] !== false && o[k] !== 0) p.push(k + '=' + encodeURIComponent(o[k])); }); return p.join('&'); }

/* ---------- drawings ---------- */
var ICON = { dress: 'M9 3 L15 3 L14 7 L18 21 L6 21 L10 7 Z', tee: 'M8 4 L4 7 L6 10 L8 9 L8 20 L16 20 L16 9 L18 10 L20 7 L16 4 Q12 7 8 4 Z', jeans: 'M7 3 L17 3 L18 21 L13 21 L12 10 L11 21 L6 21 Z', jacket: 'M8 3 L12 6 L16 3 L20 6 L20 21 L4 21 L4 6 Z M12 6 L12 21', shoe: 'M3 15 L3 11 L8 11 L11 14 L20 15 Q21 18 19 18 L3 18 Z', bag: 'M5 9 L19 9 L18 21 L6 21 Z M9 9 Q9 4 12 4 Q15 4 15 9', vase: 'M9 3 L15 3 L14 7 Q19 11 17 17 Q16 21 12 21 Q8 21 7 17 Q5 11 10 7 Z', pillow: 'M4 6 Q12 3 20 6 Q22 12 20 18 Q12 21 4 18 Q2 12 4 6 Z' };
var RAIL = ['dress', 'tee', 'jeans', 'jacket', 'shoe', 'bag', 'vase', 'pillow'];
var SHAPE = {
  dress: ['M41 8 L41 22 L33 34 L22 132 L78 132 L67 34 L59 22 L59 8', 'M41 22 Q50 28 59 22 M33 34 Q50 42 67 34 M40 60 L36 132 M60 60 L64 132'],
  bottom: ['M28 10 L72 10 L76 132 L56 132 L50 48 L44 132 L24 132 Z', 'M28 18 L72 18 M36 18 Q38 32 30 34 M64 18 Q62 32 70 34 M50 18 L50 40'],
  outer: ['M36 12 L50 24 L64 12 L84 22 L92 96 L80 98 L78 56 L78 124 L22 124 L22 56 L20 98 L8 96 L16 22 Z', 'M36 12 L44 62 L50 24 L56 62 L64 12'],
  top: ['M34 16 Q50 30 66 16 L88 34 L78 50 L70 44 L70 118 L30 118 L30 44 L22 50 L12 34 Z', 'M30 104 L70 104'],
  home: ['M38 14 L62 14 L60 34 Q86 56 78 98 Q74 128 50 128 Q26 128 22 98 Q14 56 40 34 Z', 'M40 34 Q50 40 60 34']
};
function garment(cat) { var s = SHAPE[cat] || SHAPE.dress; return '<svg class="g" viewBox="0 0 100 140" aria-hidden="true" fill="none" stroke="#1A1410" stroke-width="1.4" stroke-linejoin="round"><path d="' + s[0] + '"></path><path d="' + s[1] + '"></path></svg>'; }
function awning() {
  var BC = ['#1F4E9E', '#C8102E', '#E9A21A', '#1E7B4A'], cells = '';
  for (var r = 0; r < 2; r++) for (var k = 0; k < 24; k++) {
    if (k % 2 === 0) cells += '<span><svg viewBox="0 0 24 24" aria-hidden="true" style="animation-delay:-' + (k * 0.2).toFixed(1) + 's" fill="#FBF7F0" stroke="#1A1410" stroke-width="1.6" stroke-linejoin="round"><path d="' + ICON[RAIL[Math.floor(k / 2) % RAIL.length]] + '"></path></svg></span>';
    else cells += '<span>' + [0, 1, 2].map(function (j) { return '<i style="background:' + BC[(j + k) % 4] + '"></i>'; }).join('') + '</span>';
  }
  return '<div class="awning" aria-hidden="true"><div class="rail">' + cells + '</div></div>';
}
function photoBox(item, idx, extra) {
  var src = item.photos && item.photos.length ? item.photos[Math.min(idx || 0, item.photos.length - 1)] : null;
  return '<div class="photo" style="' + (extra || '') + 'background:var(--sand)">' + (src ? '<img class="ph" src="' + esc(src) + '" alt="' + esc(item.name) + '" loading="lazy">' : garment(item.category)) + '</div>';
}

/* ---------- people (who you shop for) ---------- */
var WSIZES = [6, 8, 10, 12, 14, 16, 18], MSIZES = ['S', 'M', 'L', 'XL', 'XXL'];
var REL = ['husband', 'wife', 'mum', 'mom', 'dad', 'sister', 'brother', 'son', 'daughter', 'aunt', 'uncle', 'grandma', 'cousin', 'friend'];
var device = store('device');
if (!device || !/^d_[a-z0-9]{16}$/.test(device)) { device = 'd_' + rid(); store('device', device); }

/* ---------- state ---------- */
var S = {
  mode: 'buyer', screen: 'feed', idx: 0, photo: 0, details: false, filters: false, search: false, query: '',
  people: store('people') || [{ id: 'me', name: 'Me', kind: 'women', size: 10 }],
  who: store('who') || 'me',
  prefs: store('prefs') || {},
  reactions: {}, offers: {},
  items: null, loading: false, meta: { areas: [] },
  deck: null, shopName: null, shopData: null, saved: null, orders: null, link: null, linkCode: null, claimFor: null,
  me: null, seller: null, sTab: 'home', sListings: null, sStatus: 'live', sOrders: null, sel: {}, linkMade: null, codeQ: '', admin: null,
  sheet: null, toast: null, edit: null, sForm: {}, profileForm: null, err: null, peopleNew: false, newName: '', newKind: 'women', newSize: 10,
};
function prof(id) { id = id || S.who; return S.people.filter(function (p) { return p.id === id; })[0] || S.people[0]; }
function isMen() { return prof().kind === 'men'; }
function P() { var k = S.who; if (!S.prefs[k]) S.prefs[k] = { cat: 'all', size: prof().size, max: 0, area: '', via: '', sort: 'new' }; return S.prefs[k]; }
function buyerKey() { return device + ':' + S.who; }
function savePeople() { store('people', S.people); store('who', S.who); store('prefs', S.prefs); }
function forWhom() { var n = (prof().name || '').trim(); if (S.who === 'me' || !n) return ''; return REL.indexOf(n.toLowerCase()) > -1 ? 'my ' + n.toLowerCase() : n; }
function catName(c) { return ({ all: 'Everything', dress: 'Dresses', top: isMen() ? 'Shirts & tops' : 'Tops', bottom: isMen() ? 'Trousers' : 'Bottoms', outer: 'Jackets', shoes: 'Shoes', bag: 'Bags', home: 'Home' })[c] || c; }

var toastTimer;
function say(msg) { S.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(function () { S.toast = null; render(); }, 4200); }
function fail(e) { say(e && e.message ? e.message : 'Something went wrong. Check your connection and try again.'); }
function set(p) { Object.assign(S, p); render(); }

/* ---------- loading data ---------- */
function loadFeed() {
  var p = P();
  var params = { cat: p.cat === 'all' ? '' : p.cat, size: p.cat === 'home' ? '' : (p.size || ''), gender: isMen() ? 'm' : 'w', max: p.max, area: p.area, via: p.via, sort: p.sort === 'new' ? '' : p.sort, q: S.query.trim() };
  if (S.deck) params = { ids: S.deck.ids.join(',') };
  S.loading = true; render();
  return api('feed?' + qs(params)).then(function (d) { S.items = d.items; S.loading = false; if (S.idx >= d.items.length) S.idx = 0; render(); }).catch(function (e) { S.loading = false; S.items = []; fail(e); });
}
function loadReactions() {
  return api('saved?buyer=' + encodeURIComponent(buyerKey())).then(function (d) {
    S.reactions = {}; S.offers = {};
    d.items.forEach(function (i) { S.reactions[i.id] = i.reaction; if (i.offer) S.offers[i.id] = i.offer; });
    S.saved = d.items; render();
  }).catch(function () {});
}
function loadOrders() { return api('orders?device=' + device).then(function (d) { S.orders = d.orders; render(); }).catch(fail); }
function loadMe() { return api('me').then(function (d) { S.me = d.shop; render(); }).catch(function () {}); }
function loadSeller() { return api('seller').then(function (d) { S.seller = d; if (!d.shop.onboarded && !S.profileForm) S.profileForm = formFrom(d.shop); render(); if (!d.shop.last_synced_at && !S.syncing) syncNow(true); }).catch(function (e) { if (e.status === 401) { S.me = null; S.seller = null; render(); } else fail(e); }); }
function loadSListings() { return api('seller/listings?status=' + S.sStatus).then(function (d) { S.sListings = d.items; render(); }).catch(fail); }
function loadSOrders() { return api('seller/orders').then(function (d) { S.sOrders = d; render(); }).catch(fail); }
function loadAdmin() { return api('admin').then(function (d) { S.admin = d; render(); }).catch(fail); }

/* ---------- routing ---------- */
function route() {
  var path = location.pathname, hash = location.hash.replace(/^#/, '');
  var m = path.match(/^\/p\/([A-Za-z0-9]{4,12})$/);
  if (m) { S.mode = 'buyer'; S.screen = 'claim'; S.linkCode = m[1].toUpperCase(); S.claimFor = S.who; api('link/' + S.linkCode).then(function (d) { S.link = d; render(); }).catch(function (e) { S.link = { error: e.message }; render(); }); return; }
  m = path.match(/^\/s\/([A-Za-z0-9._]{1,40})$/);
  if (m && !hash) { openShop(m[1]); return; }
  if (hash === 'sell') { S.mode = 'seller'; render(); loadMe().then(function () { if (S.me) loadSeller(); }); return; }
  if (hash === 'admin') { S.mode = 'admin'; render(); loadMe().then(function () { if (S.me && S.me.is_admin) loadAdmin(); }); return; }
  if (hash.indexOf('shop/') === 0) { openShop(hash.slice(5)); return; }
  S.mode = 'buyer';
  S.screen = ['saved', 'orders'].indexOf(hash) > -1 ? hash : 'feed';
  if (S.screen === 'feed' && !S.items) loadFeed();
  if (S.screen === 'orders') loadOrders();
  if (S.screen === 'saved') loadReactions();
  render();
}
function nav(hash) { if (location.pathname !== '/') history.pushState(null, '', '/' + (hash ? '#' + hash : '')); else location.hash = hash; route(); try { window.scrollTo(0, 0); } catch (e) {} }
function openShop(u) { S.mode = 'buyer'; S.screen = 'shop'; S.shopName = u; S.shopData = null; render(); api('shop/' + encodeURIComponent(u)).then(function (d) { S.shopData = d; render(); }).catch(function (e) { S.shopData = { error: e.message }; render(); }); }
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);

/* ---------- shared pieces ---------- */
function chip(on, label, a, v, extra) { return '<button class="pill sm' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-a="' + a + '" data-v="' + esc(v) + '"' + (extra || '') + '>' + esc(label) + '</button>'; }
var TABIC = { feed: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 17h6"/>', saved: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', orders: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>', home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>', pieces: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>', sold: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 9l2 2 4-4"/>', sorders: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>', shop: '<path d="M4 9l1-5h14l1 5"/><path d="M5 9v11h14V9"/><path d="M4 9a2.7 2.7 0 0 0 5 0 2.7 2.7 0 0 0 6 0 2.7 2.7 0 0 0 5 0"/>' };
function tabbar(defs, cur, action) {
  return '<nav class="tabbar" aria-label="Main"><div class="in" style="grid-template-columns:repeat(' + defs.length + ',minmax(0,1fr))">' + defs.map(function (d) {
    var on = cur === d[0];
    return '<button class="' + (on ? 'on' : '') + '" data-a="' + action + '" data-v="' + d[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + (d[2] ? '<span class="new">' + esc(d[2]) + '</span>' : '') + '<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TABIC[d[0]] || '') + '</svg></span>' + esc(d[1]) + '</button>';
  }).join('') + '</div></nav>';
}
function topBar(sub) {
  var buyer = S.mode === 'buyer';
  var person = buyer ? '<button class="pill sm" data-a="openPeople" aria-label="Shopping for ' + esc(prof().name) + '. Change person" style="flex-shrink:1;min-width:0;max-width:150px;min-height:40px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(prof().name) + '</span> ▾</button>' : '';
  var search = buyer ? '<button class="pill sm" data-a="toggleSearch" aria-label="Search" style="flex-shrink:0;width:40px;min-height:40px;padding:0"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/></svg></button>' : '';
  var more = '<button class="pill sm" data-a="openMenu" aria-label="Menu" style="flex-shrink:0;width:40px;min-height:40px;padding:0;border:none;font-size:20px;letter-spacing:1px">⋯</button>';
  return awning() + '<header class="wrap" style="padding-top:14px;padding-bottom:10px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap;align-items:center"><button data-a="home" style="border:none;background:none;padding:0;text-align:left;flex-shrink:0"><span class="serif" style="display:block;font-size:30px;line-height:1">Kabati</span>' + (sub ? '<span style="display:block;font-size:12px;margin-top:3px;color:var(--muted)">' + esc(sub) + '</span>' : '') + '</button><div class="row" style="flex-wrap:nowrap;gap:6px;min-width:0">' + person + search + more + '</div></div></header>';
}
function sizeText(i) { return i.category === 'home' ? 'One size' : (i.size_label ? 'Size ' + i.size_label : 'Size not given'); }
function priceText(i) { return i.price ? 'KSh ' + fmt(i.price) : 'Ask for price'; }

/* ---------- buyer: feed ---------- */
function buyerView() {
  var h = topBar('');
  if (S.search || S.query) h += '<div class="wrap" style="padding-bottom:8px"><label for="q" class="sr">Search</label><input id="q" type="search" data-in="query" value="' + esc(S.query) + '" placeholder="Search linen, denim, @shop, #MQ250" enterkeyhint="search"></div>';
  if (S.screen === 'feed') h += feedView();
  if (S.screen === 'saved') h += savedView();
  if (S.screen === 'orders') h += ordersView();
  if (S.screen === 'shop') h += shopView();
  if (S.screen === 'claim') h += claimView();
  h += '<footer class="wrap" style="margin-top:30px"><div class="row" style="justify-content:center"><button class="pill sm" data-a="safety">Shop safely</button><a class="pill sm" href="/#sell" style="text-decoration:none;color:var(--ink)">Sell on Kabati</a></div></footer>';
  var nSaved = Object.keys(S.reactions).length;
  h += tabbar([['feed', 'Picks'], ['saved', 'Saved', nSaved ? String(nSaved) : ''], ['orders', 'Orders']], S.screen === 'shop' || S.screen === 'claim' ? '' : S.screen, 'nav');
  return h;
}
function feedView() {
  var p = P(), h = '';
  var active = (S.orders || []).filter(function (o) { return ['done', 'issue'].indexOf(o.status) < 0; });
  if (active.length) { var o = active[0]; var UM = { paid: 'Order confirmed', packing: 'Being packed', onway: 'On the way', ready: 'Ready for pickup', delivered: 'Delivered' }; h += '<div class="wrap" style="margin-bottom:10px"><button data-a="nav" data-v="orders" style="display:flex;width:100%;align-items:center;gap:10px;border:none;background:#E6F1EA;color:var(--ink);border-radius:12px;padding:10px 12px;text-align:left;font-size:13px"><span style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc((UM[o.status] || 'Order') + ' · ' + o.shop) + '</span><span style="font-weight:700;color:var(--green);flex-shrink:0">Track ›</span></button></div>'; }
  h += '<div class="wrap">';
  if (S.deck) h += '<button class="pill sm mustard" data-a="clearDeck">Browsing: ' + esc(S.deck.title) + ' ✕</button>';
  else {
    var cats = (isMen() ? ['all', 'top', 'bottom', 'outer', 'shoes', 'home'] : ['all', 'dress', 'top', 'bottom', 'outer', 'shoes', 'bag', 'home']);
    var af = (p.size !== prof().size ? 1 : 0) + (p.max ? 1 : 0) + (p.area ? 1 : 0) + (p.via ? 1 : 0) + (p.sort !== 'new' ? 1 : 0);
    h += '<div class="chips">' + cats.map(function (c) { return chip(p.cat === c, catName(c), 'cat', c, ' style="flex-shrink:0"'); }).join('') + '<button class="pill sm' + (S.filters ? ' mustard' : '') + '" style="flex-shrink:0" aria-expanded="' + S.filters + '" data-a="toggleFilters">Filters ' + (S.filters ? '−' : '+') + (af ? ' (' + af + ')' : '') + '</button></div>';
  }
  h += '</div>';
  if (S.filters && !S.deck) {
    h += '<div class="wrap" style="margin-top:10px"><div class="card stack" style="background:var(--sand)">';
    h += '<div><span class="lbl">' + (isMen() ? 'Size' : 'Size (UK)') + ' · for ' + esc(S.who === 'me' ? 'you' : prof().name) + '</span><div class="row">' + (isMen() ? MSIZES : WSIZES).concat([0]).map(function (z) { return chip(String(p.size) === String(z), z ? String(z) : 'All', 'size', z); }).join('') + '</div></div>';
    h += '<div><span class="lbl">Price</span><div class="row">' + [[0, 'Any'], [500, 'Under 500'], [1000, 'Under 1,000'], [1500, 'Under 1,500'], [3000, 'Under 3,000']].map(function (x) { return chip(p.max === x[0], x[1], 'price', x[0]); }).join('') + '</div></div>';
    h += '<div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="lbl" for="area">Where</label><select id="area" data-ch="area"><option value="">Anywhere</option>' + S.meta.areas.map(function (a) { return '<option' + (p.area === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></div><div style="flex:1"><label class="lbl" for="sort">Order</label><select id="sort" data-ch="sort">' + [['new', 'Newest first'], ['low', 'Cheapest first'], ['want', 'Most wanted']].map(function (o) { return '<option value="' + o[0] + '"' + (p.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>';
    h += '<div><span class="lbl">Order via</span><div class="row">' + [['', 'Either'], ['ig', 'Instagram'], ['wa', 'WhatsApp']].map(function (v) { return chip(p.via === v[0], v[1], 'via', v[0]); }).join('') + '</div></div>';
    h += '<button class="link tiny" style="align-self:flex-start;font-weight:400" data-a="clearFilters">Reset filters</button></div></div>';
  }
  if (S.loading && !S.items) return h + '<section class="wrap" style="margin-top:16px"><div class="skel" style="height:420px"></div></section>';
  var list = S.items || [];
  var i = list[S.idx];
  if (i) h += cardView(i, list);
  else if (list.length) h += '<section class="wrap" style="margin-top:24px"><div class="polaroid stack" style="text-align:center;align-items:center"><p class="h2" style="margin:0">That’s everything for now.</p><p class="small" style="margin:0">New pieces arrive all day.</p><div class="row" style="justify-content:center"><button class="pill dark" data-a="restart">Start again</button></div><button class="link" data-a="prev">Back to the last piece</button></div></section>';
  else h += '<section class="wrap" style="margin-top:24px"><div class="polaroid stack" style="text-align:center;align-items:center"><p class="h2" style="margin:0">Nothing here yet.</p><p class="small" style="margin:0">' + (S.deck ? 'These pieces are no longer available.' : 'Try another size or category. More shops are joining every week.') + '</p><div class="row" style="justify-content:center"><button class="pill mustard" data-a="clearFilters">Clear filters</button></div></div></section>';
  return h;
}
function cardView(i, list) {
  var shop = i.shop, r = S.reactions[i.id], h = '';
  var n = Math.max(1, i.photos.length);
  var inSize = i.category === 'home' || !i.size_value || String(i.size_value) === String(prof().size);
  var defs = i.status === 'sold' ? [['missed', 'Missed it']] : (inSize ? [['want', 'WANT'], ['price', 'Want, but too pricey']] : [['want', 'WANT'], ['size', 'Want, but not my size'], ['price', 'Want, but too pricey']]);
  h += '<section class="wrap" style="margin-top:16px">' + (S.deck ? '<p class="tiny muted" style="margin:0 0 10px;font-weight:700">' + esc(S.deck.title) + '</p>' : (S.who !== 'me' ? '<p class="tiny muted" style="margin:0 0 10px;font-weight:700">Picks for ' + esc(prof().name) + '</p>' : ''));
  h += '<div style="display:flex;justify-content:center"><div id="card" class="polaroid" role="group" aria-roledescription="slide" aria-label="' + esc(i.name) + '. Swipe sideways or use the arrows." style="width:100%;max-width:400px;transform:none">';
  if (hoursOld(i.posted_at) < 12 && i.status !== 'sold') h += '<span class="stamp">fresh<strong style="font-size:15px">' + Math.max(1, Math.round(hoursOld(i.posted_at))) + 'h</strong></span>';
  var dots = n > 1 ? '<div class="row" style="position:absolute;top:6px;left:0;right:0;justify-content:center;gap:0;z-index:1">' + i.photos.map(function (p, k) { return '<button data-a="photo" data-v="' + k + '" aria-label="Photo ' + (k + 1) + ' of ' + n + '" style="width:32px;height:28px;border:none;background:none;display:flex;align-items:center;justify-content:center"><span style="display:block;width:' + (k === S.photo ? 22 : 8) + 'px;height:8px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px rgba(26,20,16,.35);opacity:' + (k === S.photo ? 1 : 0.6) + '"></span></button>'; }).join('') + '</div>' : '';
  var src = i.photos[S.photo] || i.photos[0];
  h += '<div class="photo" style="aspect-ratio:1/1;background:var(--sand)">' + (src ? '<img class="ph" src="' + esc(src) + '" alt="' + esc(i.name) + '" draggable="false">' : garment(i.category)) + '<span class="tag dark" style="bottom:10px;right:10px">#' + esc(i.code) + '</span>' + (i.is_video ? '<span class="tag dark" style="top:10px;right:10px">▶ video on IG</span>' : '') + (i.status === 'sold' ? '<span class="sold">SOLD</span>' : '') + dots + '</div>';
  h += '<div class="row" style="justify-content:space-between;margin-top:12px;flex-wrap:nowrap;align-items:baseline"><span class="serif" style="font-size:22px;line-height:1.15">' + esc(i.name) + '</span><span class="price">' + esc(priceText(i)) + '</span></div>';
  h += '<p class="small" style="margin:2px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:0 6px">' + esc(i.category === 'home' ? 'One size' : (i.size_label || 'size not given')) + ' ·<button data-a="goShop" data-v="' + esc(shop.username) + '" style="border:none;background:none;padding:6px 0;font-size:14px;font-weight:700;color:var(--blue);text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px">' + esc(shop.handle) + ' ✓</button>· ' + esc(shop.area) + '</p></div></div>';
  h += '<div class="stack" style="margin-top:12px;gap:10px">';
  h += '<div class="row">' + defs.map(function (d) { var on = r === d[0]; var big = d[0] === 'want' || d[0] === 'missed'; return '<button class="pill' + (on ? ' on' : (big ? ' mustard' : '')) + '" aria-pressed="' + on + '" data-a="react" data-v="' + d[0] + '" style="flex:' + (big ? '1.2 1 110px' : '1 1 140px') + ';min-height:46px;font-size:' + (big ? 16 : 13) + 'px">' + esc(d[1]) + (on ? ' ✓' : '') + '</button>'; }).join('') + '</div>';
  var offer = S.offers[i.id];
  if (r === 'price' && !offer && i.price) h += '<div class="card" style="border:2px solid var(--ink)"><p style="margin:0 0 10px;font-weight:700;font-size:14px">What would you pay? <span style="font-weight:400">Only the shop sees this, anonymously.</span></p><div class="row">' + [0.6, 0.75, 0.9].map(function (f) { var a = Math.round(i.price * f / 50) * 50; return '<button class="pill sm" data-a="offer" data-v="' + a + '">KSh ' + fmt(a) + '</button>'; }).join('') + '<button class="pill sm" data-a="offer" data-v="skip">Skip</button></div></div>';
  var notes = { want: 'Saved to your WANTs.', size: 'Noted. The shop will know people want this in size ' + prof().size + '.', price: offer ? (offer === 'skip' ? 'Noted. We’ll look out for similar pieces for less.' : 'Sent anonymously: you’d pay about KSh ' + fmt(offer) + '.') : '', missed: 'So close. Follow the shop for the next one.' };
  if (r && notes[r]) h += '<p style="margin:0;background:var(--sand);border-radius:14px;padding:10px 14px;font-size:14px">' + esc(notes[r]) + '</p>';
  if (i.status !== 'sold') h += '<div class="row">' + (shop.order_ig ? '<button class="pill dark" style="flex:1 1 150px;min-height:48px;font-size:15px" data-a="contact" data-v="ig">Instagram DM</button>' : '') + (shop.order_wa ? '<button class="pill green" style="flex:1 1 150px;min-height:48px;font-size:15px" data-a="contact" data-v="wa">WhatsApp</button>' : '') + '</div>';
  var facts = [];
  facts.push('Posted ' + ago(i.posted_at));
  if (i.condition) facts.push('★' + i.condition);
  if (i.fabric) facts.push(i.fabric);
  if (i.wants) facts.push(i.wants + ' want this');
  if (shop.level === 'New shop') facts.push('New shop');
  h += '<div class="row">' + facts.map(function (f) { var hi = f.charAt(0) === '★'; return '<span style="padding:6px 12px;border-radius:999px;border:1.5px solid var(--line);font-size:13px;' + (hi ? 'background:var(--mustard);border-color:var(--mustard);font-weight:700' : '') + '">' + esc(hi ? f.slice(1) : f) + '</span>'; }).join('') + '</div>';
  h += '<div class="row" style="gap:16px">' + (i.is_video && i.permalink ? '<a class="link" href="' + esc(i.permalink) + '" target="_blank" rel="noopener" style="color:var(--ink)">▶ Watch the video on Instagram</a>' : '') + '<button class="link" data-a="toggleDetails" aria-expanded="' + S.details + '">' + (S.details ? 'Hide details' : 'Measurements & shop info') + '</button></div>';
  if (S.details) h += detailsBoard(i, shop);
  h += '</div>';
  h += '<div class="row" style="justify-content:center;gap:16px;margin-top:4px"><button class="pill" data-a="prev" aria-label="Previous piece" style="width:48px;padding:0;opacity:' + (S.idx > 0 ? 1 : 0.35) + '">←</button><span class="serif" style="min-width:110px;text-align:center;color:var(--rust)">piece ' + (S.idx + 1) + ' of ' + list.length + '</span><button class="pill dark" data-a="next" aria-label="Next piece" style="width:48px;padding:0">→</button></div></section>';
  var up = list.slice(S.idx + 1, S.idx + 6);
  if (up.length) h += '<section class="wrap" style="margin-top:24px"><div class="board"><div class="row" style="justify-content:space-between;border-bottom:1px solid #4A3F36;padding-bottom:10px;margin-bottom:6px"><h2 class="h2">Up next</h2><span class="tiny soft">' + list.length + ' for you</span></div>' + up.map(function (x, k) { return '<button data-a="jump" data-v="' + (S.idx + 1 + k) + '" style="display:block;width:100%;text-align:left;border:none;background:none;color:var(--paper);padding:8px 0"><span class="leader serif" style="font-size:17px"><span>' + esc(x.name) + '</span><span class="dots"></span><span>' + (x.price ? fmt(x.price) : '—') + '</span></span><span class="tiny soft" style="display:block;margin-top:2px">' + esc(x.shop.handle) + ' · #' + esc(x.code) + ' · ' + esc(x.category === 'home' ? 'one size' : (x.size_label || '')) + '</span></button>'; }).join('') + '</div></section>';
  return h;
}
function detailsBoard(i, shop) {
  var h = '<div class="board stack"><p class="h2" style="margin:0">The details</p>';
  if (i.measurements && i.measurements.length) h += i.measurements.map(function (m) { return '<p class="leader serif" style="margin:0;font-size:16px"><span>' + esc(m[0]) + '</span><span class="dots"></span><span>' + esc(m[1]) + '</span></p>'; }).join('');
  else h += '<p class="small soft" style="margin:0">The shop didn’t list measurements. Ask for them in the DM.</p>';
  h += '<p class="tiny soft" style="margin:0">We only show details the shop wrote. Item code #' + esc(i.code) + '.</p>';
  h += '<div style="border-top:1px solid #4A3F36;padding-top:12px" class="stack"><p class="serif" style="margin:0;font-size:18px">' + esc(shop.handle) + ' ✓ <span class="tiny" style="font-family:inherit;background:var(--mustard);color:var(--ink);border-radius:999px;padding:2px 8px;vertical-align:middle">' + esc(shop.level) + '</span></p><p class="small" style="margin:0;line-height:1.6">' + (shop.location ? 'Find us: ' + esc(shop.location) + '<br>' : '') + (shop.delivery && shop.delivery[0] ? 'Delivery: ' + esc(shop.delivery[0][0]) : '') + '</p><div class="row"><button class="pill sm" style="border-color:var(--paper);color:var(--paper)" data-a="goShop" data-v="' + esc(shop.username) + '">Shop page</button><button class="pill sm mustard" style="border:none" data-a="browseShop" data-v="' + esc(shop.username) + '">Browse this shop</button></div></div>';
  h += '<div class="row" style="gap:14px;border-top:1px solid #4A3F36;padding-top:8px">' + (i.permalink ? '<a class="link" href="' + esc(i.permalink) + '" target="_blank" rel="noopener" style="color:var(--paper);font-weight:400">Original post</a>' : '') + '<button class="link" style="color:var(--paper);font-weight:400" data-a="reportSold">Already sold?</button></div></div>';
  return h;
}

/* ---------- buyer: saved, orders, shop, claim ---------- */
function miniCards(title, arr, sub) {
  if (!arr.length) return '';
  var ids = arr.map(function (x) { return x.id; });
  return '<section class="wrap" style="margin-top:24px"><div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:12px"><div><h2 class="h2">' + esc(title) + '</h2>' + (sub ? '<p class="small muted" style="margin:2px 0 0">' + esc(sub) + '</p>' : '') + '</div><button class="pill sm" data-a="deck" data-v="' + esc(JSON.stringify({ t: title, ids: ids, i: 0 })) + '">Browse these →</button></div><div class="grid">' + arr.map(function (x, k) {
    return '<button class="mini" data-a="deck" data-v="' + esc(JSON.stringify({ t: title, ids: ids, i: k })) + '" aria-label="Open ' + esc(x.name) + '">' + photoBox(x, 0, 'display:block;width:100%;') + (x.status === 'sold' ? '' : '') + '<span class="row serif" style="justify-content:space-between;flex-wrap:nowrap;font-size:14px;line-height:1.2;gap:6px"><span>' + esc(x.name) + '</span><span class="price sm">' + (x.price ? fmt(x.price) : '—') + '</span></span><span class="tiny muted">' + esc(x.category === 'home' ? 'one size' : (x.size_label || '')) + ' · ' + esc(x.shop.handle) + (x.status === 'sold' ? ' · SOLD' : '') + '</span></button>';
  }).join('') + '</div></section>';
}
function savedView() {
  var h = '<section class="wrap" style="margin-top:10px"><h1 class="h1">Saved</h1><p class="small muted" style="margin:4px 0 0">Your reactions' + (S.who !== 'me' ? ' for ' + esc(prof().name) : '') + '. Only you can see them.</p>';
  if (!S.saved) return h + '<div class="skel" style="height:200px;margin-top:16px"></div></section>';
  var by = function (k) { return S.saved.filter(function (x) { return x.reaction === k; }); };
  if (!S.saved.length) h += '<div class="polaroid" style="margin-top:16px"><p class="h2" style="margin:0 0 8px">Nothing saved yet</p><p class="small" style="margin:0 0 14px;line-height:1.6">Tap WANT while you browse. Pieces you react to are kept here.</p><button class="pill dark" data-a="nav" data-v="">Start browsing</button></div>';
  h += '</section>';
  return h + miniCards('Your WANTs', by('want')) + miniCards('Want, but not my size', by('size')) + miniCards('Want, but too pricey', by('price')) + miniCards('Missed it', by('missed'));
}
var BSTEPS = { delivery: [['paid', 'Paid ✓'], ['packing', 'Getting it ready'], ['onway', 'On the way'], ['delivered', 'Delivered'], ['done', 'All good ✓']], pickup: [['paid', 'Paid ✓'], ['packing', 'Getting it ready'], ['ready', 'Ready for pickup'], ['delivered', 'Picked up'], ['done', 'All good ✓']], none: [['paid', 'Paid ✓'], ['packing', 'Getting it ready'], ['onway', 'On the way or ready for pickup'], ['delivered', 'Delivered'], ['done', 'All good ✓']] };
function rank(s) { return { paid: 0, packing: 1, onway: 2, ready: 2, delivered: 3, done: 4, issue: 2 }[s] || 0; }
function detailsLine(d) {
  if (!d) return '';
  if (d.type === 'rider') return 'Rider: <strong>' + esc(d.name) + '</strong>' + (d.plate ? ' · motorbike ' + esc(d.plate) : '') + '<br>Arriving ' + esc(d.eta) + (d.phone ? '<br>Call: <a href="tel:' + esc(d.phone) + '">' + esc(d.phone) + '</a>' : '');
  if (d.type === 'courier') return 'Courier: <strong>' + esc(d.company) + '</strong><br>Tracking no. ' + esc(d.waybill) + (d.eta ? '<br>Expected ' + esc(d.eta) : '');
  if (d.type === 'bus') return 'Parcel via <strong>' + esc(d.company) + '</strong>' + (d.route ? ' · ' + esc(d.route) : '') + '<br>Parcel no. ' + esc(d.waybill) + (d.place ? '<br>Collect at ' + esc(d.place) : '');
  if (d.type === 'pickup') return 'Pick up at <strong>' + esc(d.place) + '</strong>' + (d.hours ? '<br>' + esc(d.hours) : '') + '<br>Show code <strong>' + esc(d.code) + '</strong>';
  return '';
}
function timeline(o) {
  var steps = BSTEPS[o.method || 'none'], cur = rank(o.status), log = o.log || {};
  return '<ol class="tl">' + steps.map(function (st, k) {
    var cls = k < cur ? 'done' : (k === cur ? (o.status === 'done' ? 'done' : 'now') : 'up');
    var when = log[st[0]] || (st[0] === 'onway' && log.ready);
    var extra = k === cur && (o.status === 'onway' || o.status === 'ready') && o.details ? detailsLine(o.details) : '';
    return '<li class="' + cls + '"><span class="dot"></span><span class="label">' + esc(st[1]) + '</span>' + (when ? '<span class="tiny muted"> · ' + esc(pretty(when)) + '</span>' : '') + (extra ? '<div class="small" style="margin-top:6px;background:var(--sand);border-radius:12px;padding:10px 12px;line-height:1.6">' + extra + '</div>' : '') + '</li>';
  }).join('') + '</ol>';
}
function ordersView() {
  var h = '<section class="wrap" style="margin-top:10px"><h1 class="h1">My orders</h1><p class="small muted" style="margin:4px 0 0">When a shop sends you a Kabati purchase link, the order shows here so you can track it.</p>';
  h += '<div class="row" style="margin-top:12px;flex-wrap:nowrap"><label class="sr" for="lc">Purchase link code</label><input id="lc" type="text" data-in="codeQ" value="' + esc(S.codeQ) + '" placeholder="Have a code? e.g. K7XQ9M" style="text-transform:uppercase"><button class="pill sm dark" data-a="openCode">Open</button></div>';
  if (!S.orders) return h + '<div class="skel" style="height:160px;margin-top:16px"></div></section>';
  var active = S.orders.filter(function (o) { return o.status !== 'done'; }), past = S.orders.filter(function (o) { return o.status === 'done'; });
  if (!S.orders.length) h += '<div class="polaroid" style="margin-top:16px"><p class="h2" style="margin:0 0 8px">No orders yet</p><p class="small" style="margin:0;line-height:1.6">After you pay a shop, ask them for a Kabati purchase link. Open it and your order appears here with delivery updates.</p></div>';
  if (active.length) h += '<h2 class="h2" style="margin-top:20px">On the way to you</h2>' + active.map(function (o) {
    var acts = '';
    if (['onway', 'ready', 'delivered'].indexOf(o.status) > -1) acts = '<div class="row"><button class="pill green" data-a="orderDone" data-v="' + o.id + '">' + (o.status === 'delivered' ? 'All good ✓ I got it' : 'I got it ✓') + '</button><button class="pill sm" data-a="orderIssue" data-v="' + o.id + '">Something’s wrong</button></div>';
    if (o.status === 'issue') acts = '<p class="small" style="margin:0;background:#FBE7E3;border-radius:12px;padding:10px 12px">Issue reported: ' + esc(o.issue) + '. Kabati will contact you and the shop.</p>';
    return '<article class="card stack" style="margin-top:12px"><div class="row" style="justify-content:space-between"><span class="serif" style="font-size:17px">' + esc(o.items.map(function (x) { return x.name; }).join(' + ')) + '</span><span class="serif">KSh ' + fmt(o.total) + '</span></div><p class="tiny muted" style="margin:-6px 0 0">' + esc(o.shop) + ' · ' + o.items.map(function (x) { return '#' + esc(x.code); }).join(', ') + (o.person && o.person !== 'me' ? ' · for ' + esc((prof(o.person) || {}).name || o.person) : '') + '</p>' + timeline(o) + acts + '</article>';
  }).join('');
  if (past.length) h += '<h2 class="h2" style="margin-top:24px">Done</h2><div class="stack" style="margin-top:10px">' + past.map(function (o) { return '<div class="card row" style="flex-wrap:nowrap">' + (o.items[0] && o.items[0].photo ? '<img class="thumb" src="' + esc(o.items[0].photo) + '" alt="">' : '') + '<div style="flex:1;min-width:0"><p style="margin:0;font-weight:700">' + esc(o.items.map(function (x) { return x.name; }).join(' + ')) + '</p><p class="tiny muted" style="margin:2px 0 0">' + esc(o.shop) + ' · ' + esc(day(o.created_at)) + ' · KSh ' + fmt(o.total) + '</p></div><span class="badge" style="background:var(--green);color:#fff;border-color:var(--green)">Done</span></div>'; }).join('') + '</div>';
  return h + '</section>';
}
function shopView() {
  var d = S.shopData;
  if (!d) return '<section class="wrap"><div class="skel" style="height:300px"></div></section>';
  if (d.error) return '<section class="wrap"><div class="polaroid"><p class="h2" style="margin:0">' + esc(d.error) + '</p><button class="pill" style="margin-top:12px" data-a="nav" data-v="">Back to picks</button></div></section>';
  var s = d.shop, h = '<section class="wrap" style="margin-top:10px"><div class="polaroid stack"><p class="tiny" style="margin:0;font-weight:700;color:var(--rust)">' + (s.level === 'New shop' ? 'New shop · checked by Kabati' : 'Verified shop ✓') + ' · ' + (s.has_stall ? 'physical stall' : 'online only') + '</p><h1 class="h1" style="overflow-wrap:anywhere">' + esc(s.handle) + '</h1>';
  h += '<div class="row"><span class="pill sm mustard" style="border:none">' + esc(s.level) + '</span><button class="link tiny" style="font-weight:400" data-a="levelInfo" data-v="' + esc(s.level) + '">What does this mean?</button></div>';
  h += [['Confirmed sales on Kabati', String(s.sales)], ['Came back for more', String(s.back)], ['On Kabati since', day(s.joined)], ['Order via', [s.order_ig ? 'Instagram' : '', s.order_wa ? 'WhatsApp' : ''].filter(Boolean).join(' + ') || '—']].map(function (f) { return '<p class="leader small" style="margin:0"><span>' + esc(f[0]) + '</span><span class="dots" style="border-color:var(--line)"></span><span style="font-weight:700;text-align:right">' + esc(f[1]) + '</span></p>'; }).join('');
  h += '<div class="row"><button class="pill dark" data-a="browseShop" data-v="' + esc(s.username) + '">Browse this shop</button><a class="pill" href="https://instagram.com/' + esc(s.username) + '" target="_blank" rel="noopener" style="text-decoration:none;color:var(--ink)">Instagram</a><button class="link tiny" style="font-weight:400" data-a="reportShop">Report this shop</button></div></div>';
  if (s.location) h += '<div class="card stack" style="margin-top:14px;gap:6px"><p class="h2" style="margin:0">Find us</p><p style="margin:0;font-size:15px;line-height:1.5">' + esc(s.location) + '</p>' + (s.hours ? '<p class="small muted" style="margin:0">' + esc(s.hours) + '</p>' : '') + '</div>';
  if (s.delivery && s.delivery.length) h += '<div class="card stack" style="margin-top:12px;gap:0"><p class="h2" style="margin:0 0 6px">Delivery</p>' + s.delivery.map(function (x, k) { return '<div style="padding:10px 0;' + (k ? 'border-top:1px dotted var(--line)' : '') + '"><p style="margin:0;font-size:15px;font-weight:700">' + esc(x[0]) + '</p>' + (x[1] ? '<p class="small muted" style="margin:2px 0 0;line-height:1.5">' + esc(x[1]) + '</p>' : '') + '</div>'; }).join('') + '<p class="tiny muted" style="margin:6px 0 0">Prices are set by the shop. Confirm in your DM before paying.</p></div>';
  h += '</section>';
  var live = d.items.filter(function (x) { return x.status === 'live'; });
  var mine = live.filter(function (x) { return x.category === 'home' || !x.size_value || String(x.size_value) === String(prof().size); });
  return h + miniCards('In your size', mine) + miniCards('Other sizes', live.filter(function (x) { return mine.indexOf(x) < 0; })) + miniCards('Recently sold', d.items.filter(function (x) { return x.status === 'sold'; }), 'A record of what this shop has been selling.');
}
function claimView() {
  var d = S.link;
  if (!d) return '<section class="wrap"><div class="skel" style="height:260px"></div></section>';
  if (d.error) return '<section class="wrap" style="margin-top:20px"><div class="polaroid stack"><p class="h2" style="margin:0">' + esc(d.error) + '</p><button class="pill" data-a="nav" data-v="orders">Go to My orders</button></div></section>';
  var total = d.items.reduce(function (t, x) { return t + (x.price || 0); }, 0);
  var h = '<section class="wrap" style="margin-top:20px"><div class="polaroid stack"><span class="tiny" style="align-self:flex-start;background:var(--ink);color:var(--paper);border-radius:999px;padding:4px 12px">Purchase link · ' + esc(d.code) + '</span><h1 class="serif" style="font-size:24px">' + (d.claimed ? 'This link has been used' : esc(d.shop.handle) + ' sent you ' + (d.items.length === 1 ? 'a piece' : d.items.length + ' pieces')) + '</h1>';
  h += d.items.map(function (x) { return '<div class="row" style="flex-wrap:nowrap">' + (x.photos[0] ? '<img class="thumb" src="' + esc(x.photos[0]) + '" alt="">' : '') + '<p class="leader serif" style="margin:0;font-size:16px;flex:1"><span>' + esc(x.name) + ' · #' + esc(x.code) + '</span><span class="dots" style="border-color:var(--line)"></span><span>' + (x.price ? fmt(x.price) : '—') + '</span></p></div>'; }).join('');
  if (d.claimed) h += '<button class="pill" data-a="nav" data-v="orders">Go to My orders</button>';
  else h += '<p class="small muted" style="margin:0">Total KSh ' + fmt(total) + ' (delivery not included)</p>' + (S.people.length > 1 ? '<div><span class="lbl">Whose order is this?</span><div class="row">' + S.people.map(function (p) { return chip(S.claimFor === p.id, p.name, 'claimFor', p.id); }).join('') + '</div></div>' : '') + '<button class="pill dark" style="min-height:54px;font-size:16px" data-a="claimNow">Save to My orders</button><p class="tiny muted" style="margin:0">This marks the pieces as sold on Kabati, saves them as seller-confirmed, and lets you track delivery. Each link works once.</p>';
  return h + '</div></section>';
}

/* ---------- seller ---------- */
function formFrom(shop) {
  return { area: shop.area === 'Online only' ? '' : (shop.area || ''), location: shop.location || '', hours: shop.hours || '', has_stall: !!shop.has_stall, order_ig: shop.order_ig !== false, order_wa: !!shop.order_wa, whatsapp: shop.whatsapp_number ? '0' + String(shop.whatsapp_number).slice(3) : '', delivery: (shop.delivery && shop.delivery.length ? shop.delivery : [['', '']]).map(function (d) { return [d[0], d[1]]; }) };
}
function sellerView() {
  if (S.me === null && !S.seller) return topBar('for sellers') + sellerLanding();
  if (!S.seller) return topBar('for sellers') + '<section class="wrap"><div class="skel" style="height:300px"></div></section>';
  var shop = S.seller.shop, h = topBar('for sellers · ' + shop.handle);
  if (shop.status === 'pending') h += '<div class="wrap" style="margin-bottom:10px"><p class="ok" style="margin:0;background:#FDF3DC;color:var(--ink)"><strong>We’re checking your shop.</strong> Buyers will see your pieces once Kabati approves it, usually within a day. You can set everything up meanwhile.</p></div>';
  if (shop.status === 'paused') h += '<div class="wrap" style="margin-bottom:10px"><p class="err" style="margin:0">Your shop is paused, so buyers can’t see it. Contact Kabati to fix this.</p></div>';
  if (!shop.onboarded) return h + profileForm(true);
  if (S.sTab === 'home') h += sellerHome();
  if (S.sTab === 'pieces') h += sellerPieces();
  if (S.sTab === 'sold') h += sellerSold();
  if (S.sTab === 'sorders') h += sellerOrders();
  if (S.sTab === 'shop') h += profileForm(false);
  var open = S.sOrders ? S.sOrders.orders.filter(function (o) { return ['done'].indexOf(o.status) < 0; }).length : 0;
  h += tabbar([['home', 'Home', S.seller.checks.length ? String(S.seller.checks.length) : ''], ['pieces', 'Pieces'], ['sold', 'Sold'], ['sorders', 'Orders', open ? String(open) : ''], ['shop', 'My shop']], S.sTab, 'sNav');
  return h;
}
function sellerLanding() {
  var params = new URLSearchParams(location.search);
  var msg = params.get('signin') === 'failed' ? '<p class="err" style="margin:0">Instagram sign-in didn’t work' + (params.get('why') ? ': ' + esc(params.get('why')) : '') + '. Please try again.</p>' : (params.get('signin') === 'cancelled' ? '<p class="err" style="margin:0">Sign-in was cancelled.</p>' : '');
  return '<main class="wrap stack" style="margin-top:6px;gap:16px">' + msg + '<h1 class="h1">Sell on Kabati</h1><p style="margin:0;line-height:1.6">Keep posting on Instagram as usual. Kabati turns your posts into a shop that buyers can browse by size, and sends them to your DMs or WhatsApp to buy.</p>' +
    '<div class="card stack" style="gap:8px">' + ['Free to list. Your posts appear on Kabati automatically.', 'Buyers find you by size, price and area.', 'See what shoppers want, and what they’d pay.', 'Send purchase links and track deliveries.'].map(function (t) { return '<p class="small" style="margin:0">✓ ' + esc(t) + '</p>'; }).join('') + '</div>' +
    '<a class="pill dark" href="/api/auth/instagram" style="min-height:54px;font-size:16px;text-decoration:none">Continue with Instagram</a><p class="tiny muted" style="margin:0;line-height:1.6">You need an Instagram Business or Creator account (free to switch in Instagram settings). Kabati only reads your profile and posts. It never posts or messages for you.</p></main>';
}
function profileForm(first) {
  var F = S.profileForm || (S.profileForm = formFrom(S.seller.shop));
  var areas = ['Sawa Mall', 'Gikomba', 'Kimathi Street', 'Toi Market', 'Westlands', 'Thika Road Mall', 'Online only'];
  var h = '<main class="wrap stack" style="margin-top:6px">' + (first ? '<h1 class="h1">Set up your shop</h1><p class="small muted" style="margin:0">Buyers see this on your shop page. You can change it any time.</p>' : '<h1 class="h1">My shop</h1>');
  h += '<div class="card stack"><div><span class="lbl">Where are you?</span><div class="row" style="gap:4px">' + areas.map(function (a) { return chip(F.area === a || (!F.area && a === 'Online only'), a, 'pfArea', a); }).join('') + '</div><input type="text" data-in="pf.area" value="' + esc(areas.indexOf(F.area) > -1 ? '' : F.area) + '" placeholder="Or type your area" style="margin-top:8px"></div>';
  h += '<div class="field"><label class="lbl" for="pfl">Full address (optional)</label><input id="pfl" type="text" data-in="pf.location" value="' + esc(F.location) + '" placeholder="e.g. Sawa Mall, 2nd floor, Shop 14, Moi Avenue"></div>';
  h += '<div class="field"><label class="lbl" for="pfh">Opening hours (optional)</label><input id="pfh" type="text" data-in="pf.hours" value="' + esc(F.hours) + '" placeholder="e.g. Mon–Sat, 9am–6pm"></div>';
  h += '<div class="row">' + chip(F.has_stall, 'I have a physical shop or stall', 'pfToggle', 'has_stall') + '</div></div>';
  h += '<div class="card stack"><span class="lbl">How do buyers order?</span><div class="row">' + chip(F.order_ig, 'Instagram DM', 'pfToggle', 'order_ig') + chip(F.order_wa, 'WhatsApp', 'pfToggle', 'order_wa') + '</div>' + (F.order_wa ? '<div class="field"><label class="lbl" for="pfw">WhatsApp number</label><input id="pfw" type="tel" data-in="pf.whatsapp" value="' + esc(F.whatsapp) + '" placeholder="0712 345 678"></div>' : '') + '</div>';
  h += '<div class="card stack"><span class="lbl">Delivery options</span>' + F.delivery.map(function (d, k) { return '<div class="stack" style="gap:6px;' + (k ? 'border-top:1px dotted var(--line);padding-top:10px' : '') + '"><input type="text" data-in="pf.d' + k + '.0" value="' + esc(d[0]) + '" placeholder="e.g. Nairobi CBD · KSh 150"><input type="text" data-in="pf.d' + k + '.1" value="' + esc(d[1]) + '" placeholder="e.g. Rider, same day if you order before 3pm">' + (F.delivery.length > 1 ? '<button class="link tiny" style="align-self:flex-start;font-weight:400" data-a="pfDelDel" data-v="' + k + '">Remove</button>' : '') + '</div>'; }).join('') + (F.delivery.length < 8 ? '<button class="pill sm" style="align-self:flex-start" data-a="pfDelAdd">+ Add another option</button>' : '') + '</div>';
  h += '<button class="pill dark" style="min-height:52px" data-a="pfSave">' + (first ? 'Save and see my pieces' : 'Save changes') + '</button>';
  if (!first) h += '<div class="card stack" style="gap:8px"><p class="small" style="margin:0;font-weight:700">Your Kabati link</p><p class="serif" style="margin:0;font-size:17px;overflow-wrap:anywhere">' + esc(S.seller.shop.bio_link) + '</p><button class="pill sm" style="align-self:flex-start" data-a="copyBio">Copy for your Instagram bio</button></div><button class="link" style="align-self:flex-start" data-a="logout">Sign out</button>';
  return h + '</main>';
}
function sellerHome() {
  var d = S.seller, s = d.shop, h = '<main class="wrap stack" style="margin-top:6px;gap:18px">';
  h += '<div class="row" style="flex-wrap:nowrap;justify-content:space-between"><p class="small muted" style="margin:0">' + (s.last_synced_at ? 'Instagram checked ' + esc(ago(s.last_synced_at)) : 'Not checked yet') + '</p><button class="pill sm" data-a="syncNow"' + (S.syncing ? ' disabled' : '') + '>' + (S.syncing ? 'Checking…' : 'Check Instagram now') + '</button></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' + [['Live pieces', d.counts.live, 'on Kabati now'], ['WANTs', d.wants.n, 'across ' + d.wants.pieces + ' pieces'], ['Taps to message', d.taps.ig + d.taps.wa, 'last 7 days'], ['Confirmed sales', d.sales, 'via purchase links']].map(function (x) { return '<div class="card"><p class="tiny muted" style="margin:0;font-weight:700">' + x[0] + '</p><p class="serif" style="margin:4px 0 0;font-size:30px;line-height:1">' + fmt(x[1]) + '</p><p class="tiny" style="margin:4px 0 0">' + esc(x[2]) + '</p></div>'; }).join('') + '</div>';
  var ins = d.insights, rows = '';
  ins.pricey.forEach(function (p) {
    var st = S.tp && S.tp.id === p.id ? S.tp : null;
    rows += '<div class="stack" style="gap:6px;border-bottom:1px dotted #4A3F36;padding-bottom:12px"><span class="tiny" style="align-self:flex-start;background:var(--mustard);color:var(--ink);border-radius:999px;padding:2px 10px;font-weight:700">Want, but too pricey</span><p class="serif" style="margin:0;font-size:17px;line-height:1.35">' + p.n + (p.n === 1 ? ' person wants' : ' people want') + ' your ' + esc(p.name.toLowerCase()) + ' (#' + esc(p.code) + '), but KSh ' + fmt(p.price) + ' is too much.</p>' + (p.median ? '<p class="small soft" style="margin:0">Most would pay <strong style="color:var(--paper)">KSh ' + fmt(p.median) + '</strong>.</p>' : '');
    if (st && st.step === 'confirm') rows += '<div style="background:var(--paper);color:var(--ink);border-radius:12px;padding:12px 14px" class="stack"><p style="margin:0;font-weight:700">Change #' + esc(p.code) + ' from KSh ' + fmt(p.price) + ' to <span style="color:var(--rust)">KSh ' + fmt(st.v) + '</span>?</p><p class="tiny muted" style="margin:0">The new price shows on Kabati straight away. Your Instagram post stays as it is.</p><div class="row"><button class="pill sm dark" data-a="tpConfirm">Yes, change it</button><button class="pill sm" data-a="tpCancel">Cancel</button></div></div>';
    else if (st && st.step === 'done') rows += '<div style="background:var(--paper);color:var(--ink);border-radius:12px;padding:12px 14px"><p style="margin:0;font-weight:800">New price: KSh ' + fmt(st.v) + ' ✓</p><p class="small" style="margin:2px 0 0">We’ll let the ' + p.n + ' know.</p></div>';
    else rows += '<div class="row" style="flex-wrap:nowrap;align-items:flex-end"><div style="flex:1"><label class="lbl" for="tp' + p.id + '" style="color:var(--soft)">New price (KSh)</label><input id="tp' + p.id + '" type="text" inputmode="numeric" data-in="tpv' + p.id + '" value="' + esc(S['tpv' + p.id] != null ? S['tpv' + p.id] : (p.median || '')) + '" style="background:var(--paper)"></div><button class="pill sm mustard" style="border:none;min-height:44px" data-a="tpSet" data-v="' + p.id + '">Set new price</button></div>';
    rows += '</div>';
  });
  ins.sizes.forEach(function (z) { rows += '<div class="stack" style="gap:6px;border-bottom:1px dotted #4A3F36;padding-bottom:12px"><span class="tiny" style="align-self:flex-start;border:1.5px solid var(--soft);color:var(--soft);border-radius:999px;padding:1px 10px;font-weight:700">Want, but not my size</span><p class="serif" style="margin:0;font-size:17px">' + z.n + (z.n === 1 ? ' shopper' : ' shoppers') + ' wanted your pieces in size ' + esc(z.size) + '.</p></div>'; });
  if (ins.missed) rows += '<div class="stack" style="gap:6px"><span class="tiny" style="align-self:flex-start;background:var(--rust);color:var(--paper);border-radius:999px;padding:2px 10px;font-weight:700">Missed it</span><p class="serif" style="margin:0;font-size:17px">' + ins.missed.n + ' people wanted your ' + esc(ins.missed.name.toLowerCase()) + ' after it sold.</p></div>';
  h += '<div class="board stack"><p class="h2" style="margin:0;border-bottom:1px solid #4A3F36;padding-bottom:10px">What shoppers are telling you</p>' + (rows || '<p class="small soft" style="margin:0">As shoppers react to your pieces, you’ll see here what they want and what they’d pay.</p>') + '</div>';
  h += '<section class="stack"><h2 class="h2">Check these ' + (d.checks.length ? '<span class="tiny" style="font-family:inherit;background:var(--rust);color:var(--paper);border-radius:999px;padding:2px 10px;vertical-align:middle">' + d.checks.length + '</span>' : '') + '</h2>';
  if (!d.checks.length) h += '<p class="small" style="margin:0;background:var(--green);color:var(--paper);border-radius:14px;padding:12px 14px;font-weight:700">All caught up. Every piece is sorted.</p>';
  h += d.checks.map(checkCard).join('') + '</section>';
  h += '<div class="card stack" style="background:var(--green);color:var(--paper)"><p class="tiny" style="margin:0;font-weight:700;color:var(--soft)">Photo tips</p><p class="small" style="margin:0;line-height:1.6">Shoot by a window in daylight, on a plain wall or floor, and write the size and price in your caption, like “Size 12 · KSh 900”. Kabati sorts your pieces better that way.</p></div>';
  return h + '</main>';
}
function checkCard(c) {
  var l = c.listing || {}, h = '<div class="card stack" style="gap:8px"><div class="row" style="flex-wrap:nowrap">' + (l.photo ? '<img class="thumb" src="' + esc(l.photo) + '" alt="">' : '') + '<div style="flex:1;min-width:0"><p class="serif" style="margin:0;font-size:16px">' + esc(c.question) + '</p><p class="tiny muted" style="margin:2px 0 0">' + (l.code ? '#' + esc(l.code) + ' · ' : '') + esc(l.name || '') + '</p></div></div>';
  if (c.kind === 'same') h += '<div class="row"><button class="pill sm dark" data-a="chkSame" data-v="' + c.id + '|same">Same piece</button><button class="pill sm" data-a="chkSame" data-v="' + c.id + '|different">Different pieces</button></div>';
  if (c.kind === 'price') h += '<div class="row">' + (c.payload.options || []).map(function (n) { return '<button class="pill sm" data-a="chkPrice" data-v="' + c.id + '|' + n + '">KSh ' + fmt(n) + '</button>'; }).join('') + '</div><p class="tiny muted" style="margin:0">Tap the price. The other number becomes the item number.</p>';
  if (c.kind === 'details') {
    var need = (c.payload && c.payload.need) || [];
    if (need.indexOf('price') > -1) h += '<div class="row" style="flex-wrap:nowrap"><input type="text" inputmode="numeric" data-in="chk' + c.id + '" value="' + esc(S['chk' + c.id] || '') + '" placeholder="Price in KSh"><button class="pill sm dark" data-a="chkSave" data-v="' + c.id + '|price">Save</button></div>';
    if (need.indexOf('size') > -1) h += '<div class="row" style="flex-wrap:nowrap"><input type="text" data-in="chk' + c.id + '" value="' + esc(S['chk' + c.id] || '') + '" placeholder="Size, e.g. 12 or M"><button class="pill sm dark" data-a="chkSave" data-v="' + c.id + '|size">Save</button></div>';
    if (need.indexOf('category') > -1) h += '<div class="row" style="gap:4px">' + [['dress', 'Dress'], ['top', 'Top'], ['bottom', 'Bottoms'], ['outer', 'Jacket'], ['shoes', 'Shoes'], ['bag', 'Bag'], ['home', 'Home']].map(function (x) { return '<button class="pill sm" data-a="chkCat" data-v="' + c.id + '|' + x[0] + '">' + x[1] + '</button>'; }).join('') + '<button class="pill sm" data-a="chkCat" data-v="' + c.id + '|hide">Not for sale</button></div>';
  }
  return h + '</div>';
}
function sellerPieces() {
  var h = '<main class="wrap stack" style="margin-top:6px"><h1 class="h1">Pieces</h1><div class="chips">' + [['live', 'Live'], ['check', 'Needs a look'], ['sold', 'Sold'], ['hidden', 'Hidden']].map(function (x) { return chip(S.sStatus === x[0], x[1], 'sStatus', x[0], ' style="flex-shrink:0"'); }).join('') + '</div>';
  if (!S.sListings) return h + '<div class="skel" style="height:200px"></div></main>';
  if (!S.sListings.length) h += '<p class="small muted">Nothing here.</p>';
  h += '<div>' + S.sListings.map(function (x) { return '<button class="listrow" data-a="editPiece" data-v="' + x.id + '" style="width:100%;border-left:none;border-right:none;border-bottom:none;background:none;text-align:left">' + (x.photos[0] ? '<img class="thumb" src="' + esc(x.photos[0]) + '" alt="">' : '<span class="thumb"></span>') + '<span style="flex:1;min-width:0"><span style="display:block;font-weight:700">' + esc(x.name) + '</span><span class="tiny muted">#' + esc(x.code) + ' · ' + esc(x.size_label || 'no size') + ' · ' + esc(ago(x.posted_at)) + (x.quality === 'low' ? ' · dark/blurry photo' : '') + '</span></span><span class="price sm">' + (x.price ? fmt(x.price) : '—') + '</span></button>'; }).join('') + '</div>';
  return h + '</main>';
}
function sellerSold() {
  var h = '<main class="wrap stack" style="margin-top:6px"><h1 class="h1">Sold something?</h1><p class="small muted" style="margin:0;line-height:1.6">Pick what you sold, copy the message and paste it in the buyer’s chat. When they open it, the pieces are marked sold and the order appears under Orders.</p>';
  if (S.linkMade) {
    h += '<div class="board stack"><p class="tiny soft" style="margin:0;font-weight:700">Message for your buyer</p><p style="margin:0;padding:14px;background:var(--card);color:var(--ink);border-radius:12px;font-size:14px;line-height:1.55;overflow-wrap:anywhere">' + esc(S.linkMade.message) + '</p><button class="pill mustard" style="border:none;min-height:52px" data-a="copyLink">Copy message</button><p class="tiny soft" style="margin:0">Works once. Expires in 14 days if unopened.</p></div><button class="pill" data-a="newLink">Make another link</button>';
    return h + '</main>';
  }
  if (!S.sListings || S.sStatus !== 'live') { if (S.sStatus !== 'live') { S.sStatus = 'live'; S.sListings = null; loadSListings(); } return h + '<div class="skel" style="height:200px"></div></main>'; }
  var qv = S.codeQ.trim().toLowerCase().replace(/[#\s]/g, '');
  var shown = S.sListings.filter(function (x) { return !qv || String(x.code).toLowerCase().indexOf(qv) > -1 || x.name.toLowerCase().indexOf(qv) > -1; });
  var chosen = S.sListings.filter(function (x) { return S.sel[x.id]; });
  h += '<div class="field"><label class="lbl" for="cq">Find by code or name</label><input id="cq" type="search" data-in="codeQ" value="' + esc(S.codeQ) + '" placeholder="e.g. 250 or linen"></div>';
  h += '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px">' + shown.map(function (x) { var on = !!S.sel[x.id]; return '<button class="mini" aria-pressed="' + on + '" data-a="selPiece" data-v="' + x.id + '" style="position:relative;padding:6px 6px 8px;box-shadow:' + (on ? '0 0 0 3px var(--rust)' : '0 4px 10px rgba(43,29,20,.12)') + '">' + photoBox(x, 0, 'display:block;width:100%;') + '<span class="tiny" style="font-weight:700;line-height:1.2">' + esc(x.name) + '</span><span class="tiny muted">#' + esc(x.code) + '</span>' + (on ? '<span style="position:absolute;top:-6px;right:-6px;width:26px;height:26px;border-radius:50%;background:var(--rust);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;z-index:2">✓</span>' : '') + '</button>'; }).join('') + (shown.length ? '' : '<p class="small">No live piece matches.</p>') + '</div>';
  h += '<button class="pill dark" style="min-height:52px;opacity:' + (chosen.length ? 1 : 0.4) + '" data-a="makeLink">' + (chosen.length ? 'Make a purchase link for ' + chosen.length + (chosen.length === 1 ? ' piece' : ' pieces') : 'Tap the pieces you sold') + '</button>';
  return h + '</main>';
}
var SSTEPS = { paid: 'Paid ✓', packing: 'Getting it ready', onway: 'On the way', ready: 'Ready for pickup', delivered: 'Delivered', done: 'All good ✓', issue: 'Issue reported' };
function sellerOrders() {
  var h = '<main class="wrap stack" style="margin-top:6px"><h1 class="h1">Orders</h1><p class="small muted" style="margin:0">Each step you tap shows up on your buyer’s Kabati order page.</p>';
  if (!S.sOrders) return h + '<div class="skel" style="height:200px"></div></main>';
  if (S.sOrders.waiting.length) h += '<p class="small" style="margin:0;background:var(--sand);border-radius:12px;padding:10px 12px">' + S.sOrders.waiting.length + ' purchase link' + (S.sOrders.waiting.length === 1 ? '' : 's') + ' not opened yet: ' + S.sOrders.waiting.map(function (w) { return esc(w.code); }).join(', ') + '</p>';
  if (!S.sOrders.orders.length) h += '<p class="small muted">No orders yet. Orders appear when a buyer opens your purchase link.</p>';
  h += S.sOrders.orders.map(function (o) {
    var act = '';
    if (o.status === 'paid') act = '<button class="pill dark" data-a="oStep" data-v="' + o.id + '|packing">Start packing</button>';
    if (o.status === 'packing') act = S.sFormFor === o.id ? sendForm(o) : '<div class="row"><button class="pill dark" data-a="oForm" data-v="' + o.id + '|delivery">Send it</button><button class="pill" data-a="oForm" data-v="' + o.id + '|pickup">Ready for pickup</button></div>';
    if (o.status === 'onway' || o.status === 'ready') act = '<div class="row"><button class="pill green" data-a="oStep" data-v="' + o.id + '|delivered">' + (o.status === 'ready' ? 'Mark picked up' : 'Mark delivered') + '</button><button class="pill sm" data-a="oLate" data-v="' + o.id + '">Running late</button></div>';
    if (o.status === 'delivered') act = '<p class="small muted" style="margin:0">Waiting for the buyer to tap “All good ✓”.</p>';
    if (o.status === 'done') act = '<p class="small" style="margin:0;color:var(--green);font-weight:700">Complete. This counts towards your trust level.</p>';
    if (o.status === 'issue') act = '<p class="small" style="margin:0;background:#FBE7E3;border-radius:12px;padding:10px 12px">The buyer reported: ' + esc(o.issue) + '. Kabati will be in touch.</p>';
    return '<article class="card stack"><div class="row" style="justify-content:space-between"><span class="serif" style="font-size:17px">' + esc(o.items.map(function (x) { return '#' + x.code; }).join(' + ')) + '</span><span class="badge">' + esc(SSTEPS[o.status]) + '</span></div><p class="small" style="margin:-4px 0 0">' + esc(o.items.map(function (x) { return x.name; }).join(', ')) + ' · KSh ' + fmt(o.total) + ' · ' + esc(day(o.created_at)) + '</p>' + timeline(o) + act + '</article>';
  }).join('');
  return h + '</main>';
}
function sendForm(o) {
  var F = S.sForm, t = F.type;
  var types = S.sFormMethod === 'pickup' ? [['pickup', 'Pickup point']] : [['rider', 'Rider'], ['courier', 'Courier'], ['bus', 'Bus or matatu parcel']];
  var field = function (id, label, ph) { return '<div style="flex:1 1 140px" class="field"><label class="lbl" for="f' + id + '">' + label + '</label><input id="f' + id + '" type="text" data-in="sf.' + id + '" value="' + esc(F[id] || '') + '" placeholder="' + esc(ph) + '"></div>'; };
  var h = '<div class="stack" style="border:2px dashed var(--ink);border-radius:14px;padding:12px"><div class="row">' + types.map(function (x) { return chip(t === x[0], x[1], 'sfType', x[0]); }).join('') + '</div>';
  if (t === 'rider') h += '<div class="row">' + field('name', 'Rider name', 'Brian') + field('phone', 'Rider phone', '07xx xxx xxx') + field('plate', 'Motorbike plate', 'KMDB 123B') + field('eta', 'Arriving', 'about 4pm today') + '</div>';
  if (t === 'courier') h += '<div class="row">' + field('company', 'Courier', 'e.g. G4S') + field('waybill', 'Tracking no.', '') + field('eta', 'Expected', 'tomorrow') + '</div>';
  if (t === 'bus') h += '<div class="row">' + field('company', 'Bus or matatu company', '') + field('route', 'Route', 'Nairobi → Mombasa') + field('waybill', 'Parcel no.', '') + field('place', 'Collection office', '') + '</div>';
  if (t === 'pickup') h += '<div class="row">' + field('place', 'Pickup point', S.seller.shop.location || '') + field('hours', 'Opening hours', S.seller.shop.hours || '') + '</div><p class="tiny muted" style="margin:0">Kabati gives the buyer a pickup code to show you.</p>';
  return h + '<div class="row"><button class="pill green" data-a="oSend" data-v="' + o.id + '">' + (t === 'pickup' ? 'Mark ready for pickup' : 'Mark on the way') + '</button><button class="link tiny" data-a="oCancel">Cancel</button></div></div>';
}

/* ---------- admin ---------- */
function adminView() {
  var h = topBar('admin');
  if (!S.me) return h + '<main class="wrap stack"><p>Sign in with Instagram as a Kabati admin to see this page.</p><a class="pill dark" href="/api/auth/instagram" style="text-decoration:none">Continue with Instagram</a></main>';
  if (!S.me.is_admin) return h + '<main class="wrap"><p>This page is only for Kabati admins.</p></main>';
  var d = S.admin;
  if (!d) return h + '<main class="wrap"><div class="skel" style="height:300px"></div></main>';
  h += '<main class="wrap stack" style="margin-top:6px"><h1 class="h1">Admin</h1><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' + [['Live pieces', d.totals.live], ['Confirmed sales', d.totals.sales], ['Orders', d.totals.orders], ['WANTs', d.totals.wants]].map(function (x) { return '<div class="card"><p class="tiny muted" style="margin:0;font-weight:700">' + x[0] + '</p><p class="serif" style="margin:4px 0 0;font-size:26px">' + fmt(x[1]) + '</p></div>'; }).join('') + '</div>';
  h += '<div class="card stack" style="gap:8px"><p class="small" style="margin:0;font-weight:700">Sample shops</p><p class="tiny muted" style="margin:0">Pretend shops so the app isn’t empty while real sellers join. Remove them before you launch.</p><button class="pill sm" style="align-self:flex-start" data-a="samples" data-v="' + (d.hasSamples ? 'off' : 'on') + '">' + (d.hasSamples ? 'Remove sample shops' : 'Add sample shops') + '</button></div>';
  h += '<h2 class="h2">Shops</h2>' + d.shops.map(function (s) {
    var col = { active: 'var(--green)', pending: 'var(--mustard)', paused: 'var(--rust)' }[s.status];
    return '<div class="card stack" style="gap:6px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><p style="margin:0;font-weight:700"><a href="https://instagram.com/' + esc(s.username) + '" target="_blank" rel="noopener" style="color:var(--ink)">@' + esc(s.username) + '</a>' + (s.is_sample ? ' <span class="tiny muted">(sample)</span>' : '') + '</p><p class="tiny muted" style="margin:2px 0 0">' + esc(s.area || 'no area yet') + ' · ' + (s.followers != null ? fmt(s.followers) + ' followers · ' : '') + s.live + ' live · ' + s.sales + ' sales' + (s.reports ? ' · <b style="color:var(--rust)">' + s.reports + ' reports</b>' : '') + ' · joined ' + esc(day(s.created_at)) + '</p></div><span class="badge" style="border-color:' + col + ';color:' + col + '">' + esc(s.status) + '</span></div><div class="row">' + (s.status !== 'active' ? '<button class="pill sm green" data-a="shopStatus" data-v="' + s.id + '|active">' + (s.status === 'pending' ? 'Approve' : 'Turn back on') + '</button>' : '<button class="pill sm" data-a="shopStatus" data-v="' + s.id + '|paused">Pause</button>') + (!s.is_sample ? '<button class="pill sm" data-a="shopSync" data-v="' + s.id + '">Check Instagram</button>' : '') + '</div></div>';
  }).join('');
  h += '<h2 class="h2">Reports</h2>' + (d.reports.length ? d.reports.map(function (r) { return '<div class="card row" style="flex-wrap:nowrap"><div style="flex:1;min-width:0"><p style="margin:0;font-weight:700">' + esc(r.kind) + ' · @' + esc(r.username || '?') + (r.code ? ' · #' + esc(r.code) : '') + '</p><p class="tiny muted" style="margin:2px 0 0">' + esc(r.note || r.listing_name || '') + ' · ' + esc(day(r.created_at)) + '</p></div><button class="pill sm" data-a="closeReport" data-v="' + r.id + '">Done</button></div>'; }).join('') : '<p class="small muted">No open reports.</p>');
  return h + '</main>';
}

/* ---------- sheets ---------- */
function sheetView() {
  if (!S.sheet) return '';
  var h = '<div class="scrim" data-a="closeSheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(S.sheet) + '" data-stop="1"><div class="grab"></div>';
  if (S.sheet === 'menu') {
    h += '<p class="h2" style="margin:0 0 10px">Kabati</p>' + [['nav', '', 'Shop'], ['goSell', '', S.me ? 'My shop (seller)' : 'Sell on Kabati']].concat(S.me && S.me.is_admin ? [['goAdmin', '', 'Admin']] : []).map(function (x) { return '<button data-a="' + x[0] + '" data-v="' + x[1] + '" style="display:block;width:100%;text-align:left;padding:14px;margin-bottom:8px;border-radius:14px;border:1.5px solid var(--line);background:var(--card);font-weight:700">' + esc(x[2]) + '</button>'; }).join('') + '<p class="tiny muted" style="margin:6px 0 0;line-height:1.6">Your favourite shops, sorted. Kabati shows pieces from Instagram shops; you buy directly from the shop.</p>';
  }
  if (S.sheet === 'people') {
    h += '<p class="h2" style="margin:0 0 12px">Shopping for</p>' + S.people.map(function (p) { var on = p.id === S.who; return '<button data-a="pickPerson" data-v="' + p.id + '" aria-pressed="' + on + '" style="display:flex;width:100%;justify-content:space-between;align-items:center;padding:14px;margin-bottom:8px;border-radius:14px;border:1.5px solid ' + (on ? 'var(--ink)' : 'var(--line)') + ';background:' + (on ? 'var(--ink)' : 'var(--card)') + ';color:' + (on ? 'var(--paper)' : 'var(--ink)') + ';font-size:16px;font-weight:700">' + esc(p.name) + (on ? '<span>✓</span>' : '') + '</button>'; }).join('') + '<button class="pill" style="width:100%" data-a="openProfiles">Add or edit people</button>';
  }
  if (S.sheet === 'profiles') {
    h += '<p class="h2" style="margin:0 0 4px">People you shop for</p><p class="small muted" style="margin:0 0 12px">Enter each person’s size once. Their picks and saved pieces stay separate. They don’t need Instagram or a Kabati account.</p>';
    h += S.people.map(function (p) { var sz = p.kind === 'men' ? MSIZES : WSIZES; return '<div class="card stack" style="margin-bottom:10px;gap:8px"><div class="row" style="flex-wrap:nowrap;align-items:flex-end"><div style="flex:1"><label class="lbl" for="pn' + p.id + '">Name</label><input id="pn' + p.id + '" type="text" data-in="person.' + p.id + '" value="' + esc(p.name) + '"></div><span class="tiny muted" style="padding-bottom:12px">' + (p.kind === 'men' ? 'Menswear' : 'Womenswear') + '</span></div><div><span class="lbl">Clothes size</span><div class="row" style="gap:4px">' + sz.map(function (z) { return chip(String(p.size) === String(z), String(z), 'personSize', p.id + '|' + z); }).join('') + '</div></div>' + (p.id === 'me' ? '' : '<button class="link tiny" style="align-self:flex-start;font-weight:400;color:var(--rust)" data-a="personDel" data-v="' + p.id + '">Delete ' + esc(p.name) + '</button>') + '</div>'; }).join('');
    if (S.peopleNew) { var nz = S.newKind === 'men' ? MSIZES : WSIZES; h += '<div class="card stack" style="border:2px dashed var(--ink);gap:10px"><div><label class="lbl" for="npn">Name</label><input id="npn" type="text" data-in="newName" value="' + esc(S.newName) + '" placeholder="e.g. Otieno, Mum, Wanjiru"></div><div><span class="lbl">Shops for</span><div class="row">' + chip(S.newKind === 'women', 'Womenswear', 'newKind', 'women') + chip(S.newKind === 'men', 'Menswear', 'newKind', 'men') + '</div></div><div><span class="lbl">Clothes size</span><div class="row" style="gap:4px">' + nz.map(function (z) { return chip(String(S.newSize) === String(z), String(z), 'newSize', z); }).join('') + '</div></div><button class="pill dark" data-a="personAdd">Add person</button></div>'; }
    else h += '<button class="pill" style="width:100%" data-a="peopleNew">+ Add someone</button>';
  }
  if (S.sheet === 'issue') h += '<p class="h2" style="margin:0 0 10px">What went wrong?</p>' + ['It hasn’t arrived', 'Wrong item', 'Damaged or not as described', 'Something else'].map(function (x) { return '<button class="pill" style="width:100%;margin-bottom:8px;justify-content:flex-start" data-a="issuePick" data-v="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '<p class="tiny muted" style="margin:6px 0 0">Kabati will contact you and the shop.</p>';
  if (S.sheet === 'edit' && S.edit) {
    var e = S.edit;
    h += '<p class="h2" style="margin:0 0 10px">#' + esc(e.code) + '</p>' + (e.photos[0] ? '<img src="' + esc(e.photos[0]) + '" alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px">' : '') + '<div class="stack" style="margin-top:12px">' +
      '<div class="field"><label class="lbl" for="en">Name</label><input id="en" type="text" data-in="ed.name" value="' + esc(e.name) + '"></div>' +
      '<div class="row" style="flex-wrap:nowrap"><div class="field" style="flex:1"><label class="lbl" for="ep">Price (KSh)</label><input id="ep" type="text" inputmode="numeric" data-in="ed.price" value="' + esc(e.price || '') + '"></div><div class="field" style="flex:1"><label class="lbl" for="es">Size</label><input id="es" type="text" data-in="ed.size" value="' + esc(e.size_label || '') + '" placeholder="12, M or one size"></div></div>' +
      '<div><span class="lbl">Kind</span><div class="row" style="gap:4px">' + [['dress', 'Dress'], ['top', 'Top'], ['bottom', 'Bottoms'], ['outer', 'Jacket'], ['shoes', 'Shoes'], ['bag', 'Bag'], ['home', 'Home'], ['other', 'Other']].map(function (x) { return chip(e.category === x[0], x[1], 'edCat', x[0]); }).join('') + '</div></div>' +
      '<div><span class="lbl">For</span><div class="row" style="gap:4px">' + [['w', 'Women'], ['m', 'Men'], ['u', 'Anyone']].map(function (x) { return chip(e.gender === x[0], x[1], 'edGender', x[0]); }).join('') + '</div></div>' +
      '<button class="pill dark" data-a="edSave">Save</button><div class="row">' + (e.status !== 'sold' ? '<button class="pill sm" data-a="edStatus" data-v="sold">Mark sold</button>' : '') + (e.status !== 'hidden' ? '<button class="pill sm" data-a="edStatus" data-v="hidden">Hide from Kabati</button>' : '') + (e.status !== 'live' ? '<button class="pill sm green" data-a="edStatus" data-v="live">Show on Kabati</button>' : '') + '</div><p class="tiny muted" style="margin:0">Changes show on Kabati only. Your Instagram post stays as it is.</p></div>';
  }
  return h + '</div></div>';
}

/* ---------- render ---------- */
function render() {
  var root = document.getElementById('app');
  var focusId = document.activeElement && document.activeElement.id, pos = null;
  try { pos = document.activeElement.selectionStart; } catch (e) {}
  root.innerHTML = S.mode === 'seller' ? sellerView() : (S.mode === 'admin' ? adminView() : buyerView());
  document.getElementById('layer').innerHTML = sheetView() + (S.toast ? '<div class="toast" role="status">' + esc(S.toast) + '</div>' : '');
  if (focusId) { var f = document.getElementById(focusId); if (f && (f.tagName === 'INPUT')) { f.focus(); try { if (pos != null) f.setSelectionRange(pos, pos); } catch (e) {} } }
  bindCard();
}

/* ---------- swiping ---------- */
var busy = false;
function feedList() { return S.items || []; }
function flip(dir) {
  if (busy) return;
  var len = feedList().length, c0 = document.getElementById('card');
  if ((dir > 0 && S.idx >= len) || (dir < 0 && S.idx <= 0)) { if (c0) { c0.classList.remove('drag'); c0.style.transform = 'none'; } if (dir < 0) say('This is the first piece. Swipe left to see more.'); return; }
  if (S.idx >= len) { S.idx--; S.photo = 0; render(); return; }
  busy = true;
  if (c0) c0.style.transform = 'translateX(' + (dir > 0 ? -700 : 700) + 'px) rotate(' + (dir > 0 ? -20 : 20) + 'deg)';
  setTimeout(function () { busy = false; S.idx += dir; S.photo = 0; S.details = false; render(); }, 200);
}
function bindCard() {
  var c = document.getElementById('card'); if (!c) return;
  var sx = null, sy = 0, dx = 0, moved = false, lock = null, t0 = 0, far = 0;
  var start = function (x, y) { sx = x; sy = y; dx = 0; moved = false; lock = null; far = 0; t0 = Date.now(); c.classList.add('drag'); };
  var move = function (x, y, ev) { if (sx == null) return; var mx = x - sx, my = y - sy; far = Math.max(far, Math.abs(mx), Math.abs(my)); if (!lock && (Math.abs(mx) > 8 || Math.abs(my) > 8)) lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; if (lock === 'x') { if (ev && ev.cancelable) ev.preventDefault(); dx = mx; moved = true; c.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 24) + 'deg)'; } };
  var end = function () { if (sx == null) return; sx = null; var ms = Math.max(1, Date.now() - t0); var w = c.offsetWidth || 340; var fling = Math.abs(dx) > 50 && Math.abs(dx) / ms > 0.6; var go = lock === 'x' && (Math.abs(dx) > w * 0.4 || fling); c.classList.remove('drag'); if (go && dx < 0) flip(1); else if (go && dx > 0) flip(-1); else { c.style.transform = 'none'; var it = feedList()[S.idx]; if (!lock && far < 8 && ms < 350 && it && it.photos.length > 1) { S.photo = (S.photo + 1) % it.photos.length; render(); } } };
  c.addEventListener('touchstart', function (e) { if (e.target.closest('[data-a]')) return; var t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
  c.addEventListener('touchmove', function (e) { var t = e.touches[0]; move(t.clientX, t.clientY, e); }, { passive: false });
  c.addEventListener('touchend', function (e) { var wasTap = sx != null && !lock; end(); if (wasTap && e.cancelable) e.preventDefault(); });
  c.addEventListener('touchcancel', end);
  c.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.target.closest('[data-a]')) return; start(e.clientX, e.clientY); try { c.setPointerCapture(e.pointerId); } catch (err) {} });
  c.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') move(e.clientX, e.clientY, e); });
  c.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse') end(); });
}

/* ---------- actions ---------- */
function cur() { return feedList()[S.idx]; }
function syncNow(silent) {
  S.syncing = true; render();
  return api('seller/sync', { body: {} }).then(function (r) {
    S.syncing = false;
    if (!silent) say(r.added ? r.added + ' new piece' + (r.added === 1 ? '' : 's') + ' added.' + (r.remaining ? ' Still reading ' + r.remaining + ' more…' : '') : (r.remaining ? 'Still reading your posts…' : 'You’re up to date.'));
    return loadSeller().then(function () { if (r.remaining) return syncNow(true); });
  }).catch(function (e) { S.syncing = false; fail(e); });
}
function clip(text) { try { navigator.clipboard.writeText(text); return true; } catch (e) { return false; } }
var A = {
  nav: function (v) { S.sheet = null; if (S.deck) { S.deck = null; S.items = null; } nav(v || ''); },
  home: function () { if (S.mode === 'buyer') { S.deck = null; S.idx = 0; nav(''); S.items = null; loadFeed(); } else if (S.mode === 'seller') set({ sTab: 'home' }); else loadAdmin(); },
  goSell: function () { S.sheet = null; nav('sell'); },
  goAdmin: function () { S.sheet = null; nav('admin'); },
  openMenu: function () { set({ sheet: 'menu' }); },
  closeSheet: function (v, el, e) { if (e && e.target !== el) return; set({ sheet: null }); },
  toggleSearch: function () { set({ search: !S.search }); setTimeout(function () { var q = document.getElementById('q'); if (q) q.focus(); }, 0); },
  cat: function (v) { P().cat = v; savePeople(); S.idx = 0; S.deck = null; loadFeed(); },
  toggleFilters: function () { set({ filters: !S.filters }); },
  size: function (v) { P().size = v === '0' ? 0 : (isNaN(Number(v)) ? v : Number(v)); savePeople(); S.idx = 0; loadFeed(); },
  price: function (v) { P().max = Number(v); savePeople(); S.idx = 0; loadFeed(); },
  via: function (v) { P().via = v; savePeople(); S.idx = 0; loadFeed(); },
  clearFilters: function () { S.prefs[S.who] = null; P(); S.query = ''; S.deck = null; savePeople(); S.idx = 0; loadFeed(); },
  clearDeck: function () { S.deck = null; S.idx = 0; loadFeed(); },
  deck: function (v) { var d = JSON.parse(v); S.deck = { title: d.t, ids: d.ids }; S.idx = d.i; S.photo = 0; S.screen = 'feed'; if (location.pathname !== '/' || location.hash) history.pushState(null, '', '/'); loadFeed(); try { window.scrollTo(0, 0); } catch (e) {} },
  browseShop: function (v) { api('shop/' + encodeURIComponent(v)).then(function (d) { var ids = d.items.filter(function (x) { return x.status === 'live'; }).map(function (x) { return x.id; }); A.deck(JSON.stringify({ t: '@' + v, ids: ids, i: 0 })); }).catch(fail); },
  goShop: function (v) { history.pushState(null, '', '/#shop/' + v); openShop(v); try { window.scrollTo(0, 0); } catch (e) {} },
  photo: function (v) { set({ photo: Number(v) }); },
  prev: function () { flip(-1); }, next: function () { flip(1); },
  jump: function (v) { set({ idx: Number(v), photo: 0, details: false }); try { window.scrollTo(0, 0); } catch (e) {} },
  restart: function () { set({ idx: 0, photo: 0 }); },
  toggleDetails: function () { set({ details: !S.details }); },
  react: function (v) {
    var i = cur(); if (!i) return;
    var kind = S.reactions[i.id] === v ? null : v;
    if (kind) S.reactions[i.id] = kind; else delete S.reactions[i.id];
    delete S.offers[i.id]; render();
    api('react', { body: { buyer: buyerKey(), listing: i.id, kind: kind, size: prof().size } }).catch(fail);
  },
  offer: function (v) { var i = cur(); S.offers[i.id] = v === 'skip' ? 'skip' : Number(v); render(); if (v !== 'skip') api('react', { body: { buyer: buyerKey(), listing: i.id, kind: 'price', size: prof().size, offer: Number(v) } }).catch(fail); },
  contact: function (v) {
    var i = cur(), shop = i.shop;
    var msg = 'Hi! I found this on Kabati: is #' + i.code + ', the ' + i.name.toLowerCase() + ' (' + (i.category === 'home' ? '' : (i.size_label ? 'size ' + i.size_label + ', ' : '')) + priceText(i) + '), still available?' + (forWhom() ? ' It’s for ' + forWhom() + '.' : '');
    api('contact', { body: { listing: i.id, channel: v } }).catch(function () {});
    if (v === 'wa') { window.open('https://wa.me/' + shop.whatsapp + '?text=' + encodeURIComponent(msg), '_blank'); return; }
    clip(msg);
    say('Message copied. Paste it in your DM to ' + shop.handle + '.');
    setTimeout(function () { window.open('https://ig.me/m/' + shop.username, '_blank'); }, 700);
  },
  reportSold: function () { var i = cur(); api('report', { body: { listing: i.id, kind: 'sold' } }).then(function () { say('Thanks. If others say the same, we hide it until the shop confirms.'); }).catch(fail); },
  reportShop: function () { api('report', { body: { shop: S.shopName, kind: 'fake', note: 'Reported from shop page' } }).then(function () { say('Report received. We review it privately.'); }).catch(fail); },
  safety: function () { say('Shop safely: check the exact @handle before paying, and for a first order with a new shop, consider paying on delivery.'); },
  levelInfo: function (v) { var m = { 'New shop': 'New shop: recently joined. Kabati has checked the Instagram account, but there are no confirmed sales yet.', 'Rising': 'Rising: at least 3 confirmed sales through Kabati purchase links.', 'Trusted': 'Trusted: 15 or more confirmed sales.', 'Top shop': 'Top shop: 40 or more confirmed sales.' }; say(m[v] || ''); },
  openPeople: function () { set({ sheet: 'people' }); },
  openProfiles: function () { set({ sheet: 'profiles', peopleNew: false }); },
  pickPerson: function (v) { S.sheet = null; S.who = v; savePeople(); S.idx = 0; S.deck = null; S.reactions = {}; loadReactions(); if (S.screen === 'feed') loadFeed(); else render(); },
  personSize: function (v) { var p = v.split('|'); var pr = prof(p[0]); pr.size = isNaN(Number(p[1])) ? p[1] : Number(p[1]); if (S.prefs[p[0]]) S.prefs[p[0]].size = pr.size; savePeople(); render(); if (p[0] === S.who && S.screen === 'feed') loadFeed(); },
  personDel: function (v) { if (S.who === v) S.who = 'me'; S.people = S.people.filter(function (p) { return p.id !== v; }); delete S.prefs[v]; savePeople(); render(); loadFeed(); },
  peopleNew: function () { set({ peopleNew: true, newName: '', newKind: 'women', newSize: 10 }); },
  newKind: function (v) { set({ newKind: v, newSize: v === 'men' ? 'M' : 10 }); },
  newSize: function (v) { set({ newSize: isNaN(Number(v)) ? v : Number(v) }); },
  personAdd: function () { var n = S.newName.trim(); if (!n) { say('Add a name first.'); return; } var id = 'p' + Date.now().toString(36); S.people.push({ id: id, name: n.slice(0, 30), kind: S.newKind, size: S.newSize }); S.who = id; savePeople(); S.sheet = null; S.idx = 0; S.reactions = {}; loadFeed(); say('Added ' + n + '. You’re now shopping for ' + n + '.'); },
  claimFor: function (v) { set({ claimFor: v }); },
  claimNow: function () { api('link/' + S.linkCode + '/claim', { body: { buyer: device + ':' + (S.claimFor || S.who) } }).then(function () { history.replaceState(null, '', '/#orders'); S.link = null; say('Saved to My orders. You can track it here.'); route(); }).catch(fail); },
  openCode: function () { var c = S.codeQ.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length < 4) { say('Enter the code from your purchase link.'); return; } history.pushState(null, '', '/p/' + c); S.codeQ = ''; route(); },
  orderDone: function (v) { api('orders/' + v + '/done', { body: { device: device } }).then(function () { say('Thanks! Order complete.'); loadOrders(); }).catch(fail); },
  orderIssue: function (v) { set({ sheet: 'issue', issueOrder: v }); },
  issuePick: function (v) { S.sheet = null; api('orders/' + S.issueOrder + '/issue', { body: { device: device, issue: v } }).then(function () { say('Reported. Kabati will contact you and the shop.'); loadOrders(); }).catch(fail); },
  /* seller */
  sNav: function (v) { S.sTab = v; S.sFormFor = null; S.linkMade = v === 'sold' ? null : S.linkMade; if (v === 'pieces' || v === 'sold') { if (v === 'sold') S.sStatus = 'live'; S.sListings = null; loadSListings(); } if (v === 'sorders') loadSOrders(); if (v === 'home') loadSeller(); if (v === 'shop') S.profileForm = formFrom(S.seller.shop); render(); try { window.scrollTo(0, 0); } catch (e) {} },
  syncNow: function () { syncNow(false); },
  pfArea: function (v) { S.profileForm.area = v === 'Online only' ? '' : v; render(); },
  pfToggle: function (v) { S.profileForm[v] = !S.profileForm[v]; render(); },
  pfDelAdd: function () { S.profileForm.delivery.push(['', '']); render(); },
  pfDelDel: function (v) { S.profileForm.delivery.splice(Number(v), 1); render(); },
  pfSave: function () {
    var F = S.profileForm;
    var body = { area: F.area || 'Online only', location: F.location, hours: F.hours, has_stall: F.has_stall, order_ig: F.order_ig, order_wa: F.order_wa, whatsapp: F.whatsapp, delivery: F.delivery.filter(function (d) { return d[0].trim(); }), onboarded: true };
    if (!body.order_ig && !body.order_wa) { say('Choose at least one way for buyers to order.'); return; }
    api('seller/profile', { body: body }).then(function () { say('Saved.'); S.sTab = 'home'; return loadSeller(); }).catch(fail);
  },
  copyBio: function () { clip(S.seller.shop.bio_link); say('Copied. Paste it into your Instagram bio.'); },
  logout: function () { api('auth/logout', { body: {} }).then(function () { S.me = null; S.seller = null; nav(''); }); },
  tpSet: function (v) { var raw = S['tpv' + v]; var p = S.seller.insights.pricey.filter(function (x) { return String(x.id) === String(v); })[0]; var n = Number(String(raw != null ? raw : (p.median || '')).replace(/[^0-9]/g, '')); if (!n) { say('Enter the new price.'); return; } if (n >= p.price) { say('That’s not lower than KSh ' + fmt(p.price) + '.'); return; } set({ tp: { id: p.id, v: n, step: 'confirm' } }); },
  tpConfirm: function () { var t = S.tp; api('seller/listings/' + t.id, { body: { price: t.v } }).then(function () { S.tp = { id: t.id, v: t.v, step: 'done' }; say('Done. The new price is on Kabati.'); }).catch(fail); },
  tpCancel: function () { set({ tp: null }); },
  chkSame: function (v) { var p = v.split('|'); api('seller/checks/' + p[0], { body: { answer: p[1] } }).then(function () { say(p[1] === 'same' ? 'Merged into one listing.' : 'Kept as separate pieces.'); loadSeller(); }).catch(fail); },
  chkPrice: function (v) { var p = v.split('|'); var c = S.seller.checks.filter(function (x) { return String(x.id) === p[0]; })[0]; var other = (c.payload.options || []).filter(function (n) { return String(n) !== p[1]; })[0]; api('seller/checks/' + p[0], { body: { price: Number(p[1]), code: other } }).then(function () { say('Saved: KSh ' + fmt(p[1]) + '.'); loadSeller(); }).catch(fail); },
  chkSave: function (v) { var p = v.split('|'); var val = S['chk' + p[0]]; if (!val) { say('Fill it in first.'); return; } var b = {}; b[p[1]] = val; api('seller/checks/' + p[0], { body: b }).then(function () { S['chk' + p[0]] = ''; say('Saved.'); loadSeller(); }).catch(fail); },
  chkCat: function (v) { var p = v.split('|'); var b = p[1] === 'hide' ? { status: 'hidden' } : { category: p[1] }; api('seller/checks/' + p[0], { body: b }).then(function () { say('Saved.'); loadSeller(); }).catch(fail); },
  sStatus: function (v) { S.sStatus = v; S.sListings = null; loadSListings(); render(); },
  editPiece: function (v) { var x = S.sListings.filter(function (l) { return String(l.id) === v; })[0]; S.edit = Object.assign({}, x); S.ed = { name: x.name, price: x.price || '', size: x.size_label || '' }; set({ sheet: 'edit' }); },
  edCat: function (v) { S.edit.category = v; render(); },
  edGender: function (v) { S.edit.gender = v; render(); },
  edSave: function () { var e = S.edit, d = S.ed || {}; api('seller/listings/' + e.id, { body: { name: d.name, price: d.price, size: d.size, category: e.category, gender: e.gender } }).then(function () { S.sheet = null; say('Saved.'); loadSListings(); }).catch(fail); },
  edStatus: function (v) { api('seller/listings/' + S.edit.id, { body: { status: v } }).then(function () { S.sheet = null; say(v === 'sold' ? 'Marked sold.' : v === 'hidden' ? 'Hidden from Kabati.' : 'Back on Kabati.'); loadSListings(); }).catch(fail); },
  selPiece: function (v) { S.sel[v] = !S.sel[v]; render(); },
  makeLink: function () { var ids = Object.keys(S.sel).filter(function (k) { return S.sel[k]; }); if (!ids.length) { say('Tap the pieces you sold first.'); return; } api('seller/links', { body: { listing_ids: ids } }).then(function (d) { S.linkMade = d; S.sel = {}; render(); }).catch(fail); },
  copyLink: function () { clip(S.linkMade.message); say('Copied. Paste it in your buyer’s Instagram or WhatsApp chat.'); },
  newLink: function () { S.linkMade = null; S.sListings = null; loadSListings(); render(); },
  oStep: function (v) { var p = v.split('|'); api('seller/orders/' + p[0], { body: { status: p[1] } }).then(function () { say('Updated. Your buyer can see it.'); loadSOrders(); }).catch(fail); },
  oForm: function (v) { var p = v.split('|'); S.sFormFor = Number(p[0]); S.sFormMethod = p[1]; S.sForm = { type: p[1] === 'pickup' ? 'pickup' : 'rider' }; render(); },
  sfType: function (v) { S.sForm.type = v; render(); },
  oCancel: function () { set({ sFormFor: null }); },
  oSend: function (v) { var F = S.sForm; api('seller/orders/' + v, { body: { status: F.type === 'pickup' ? 'ready' : 'onway', details: F } }).then(function () { S.sFormFor = null; say(F.type === 'pickup' ? 'Ready for pickup. Your buyer has the pickup code.' : 'On the way. Your buyer can see the delivery details.'); loadSOrders(); }).catch(fail); },
  oLate: function (v) { api('seller/orders/' + v, { body: { late: true } }).then(function () { say('Your buyer can see it’s running late.'); loadSOrders(); }).catch(fail); },
  /* admin */
  samples: function (v) { api('admin/samples', { body: { on: v === 'on' } }).then(function () { say(v === 'on' ? 'Sample shops added.' : 'Sample shops removed.'); S.items = null; loadAdmin(); }).catch(fail); },
  shopStatus: function (v) { var p = v.split('|'); api('admin/shops/' + p[0], { body: { status: p[1] } }).then(function () { say('Updated.'); loadAdmin(); }).catch(fail); },
  shopSync: function (v) { say('Checking Instagram…'); api('admin/shops/' + v + '/sync', { body: {} }).then(function (r) { say((r.added || 0) + ' new pieces added.'); loadAdmin(); }).catch(fail); },
  closeReport: function (v) { api('admin/reports/' + v, { body: {} }).then(loadAdmin).catch(fail); },
};

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-a]'); if (!el) return;
  var a = el.getAttribute('data-a');
  if (A[a]) { e.preventDefault(); A[a](el.getAttribute('data-v'), el, e); }
});
var qTimer;
document.addEventListener('input', function (e) {
  var el = e.target, k = el.getAttribute && el.getAttribute('data-in'); if (!k) return;
  var v = el.value;
  if (k === 'query') { S.query = v; clearTimeout(qTimer); qTimer = setTimeout(function () { S.idx = 0; S.deck = null; S.screen = 'feed'; loadFeed(); }, 350); return; }
  if (k.indexOf('pf.') === 0) { var f = k.slice(3); if (f.charAt(0) === 'd' && f.indexOf('.') > 0) { var pp = f.slice(1).split('.'); S.profileForm.delivery[Number(pp[0])][Number(pp[1])] = v; } else S.profileForm[f] = v; return; }
  if (k.indexOf('sf.') === 0) { S.sForm[k.slice(3)] = v; return; }
  if (k.indexOf('ed.') === 0) { S.ed = S.ed || {}; S.ed[k.slice(3)] = v; return; }
  if (k.indexOf('person.') === 0) { var pr = prof(k.slice(7)); if (pr) { pr.name = v.slice(0, 30); savePeople(); } return; }
  if (k === 'codeQ' && S.mode === 'seller') { S.codeQ = v; render(); return; }
  S[k] = v;
});
document.addEventListener('change', function (e) {
  var el = e.target, k = el.getAttribute && el.getAttribute('data-ch'); if (!k) return;
  P()[k] = el.value; savePeople(); S.idx = 0; loadFeed();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && S.sheet) set({ sheet: null });
  if (e.key === 'Enter' && e.target.id === 'lc') A.openCode();
  if (S.mode === 'buyer' && S.screen === 'feed' && !S.sheet && document.activeElement.tagName !== 'INPUT') { if (e.key === 'ArrowRight') flip(1); if (e.key === 'ArrowLeft') flip(-1); }
});

/* ---------- start ---------- */
api('meta').then(function (d) { S.meta = d; }).catch(function () {});
loadMe();
loadReactions();
api('orders?device=' + device).then(function (d) { S.orders = d.orders; render(); }).catch(function () {});
route();
})();
