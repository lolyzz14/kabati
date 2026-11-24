// Pretend Instagram posts for testing on a computer (FAKE_IG=1). Covers the tricky cases.
const now = Date.now();
const h = (n) => new Date(now - n * 3600000).toISOString();
const img = (n) => '/demo/' + n + '.jpg';

const POSTS = [
  { id: 'p1', media_type: 'IMAGE', media_url: img('linen-midi'), permalink: 'https://www.instagram.com/p/fake1/', timestamp: h(30),
    caption: 'Linen midi dress 🌿 Size 10 | 900/= | 100% linen. Pit to pit 48cm, length 112cm. DM to order 💌' },
  { id: 'p2', media_type: 'CAROUSEL_ALBUM', permalink: 'https://www.instagram.com/p/fake2/', timestamp: h(26),
    caption: 'No. 251 Wide-leg trousers, size 10, KSh 950\nNo. 252 Satin blouse, size 8, KSh 650\nMint condition both 🔥',
    children: { data: [{ id: 'p2a', media_type: 'IMAGE', media_url: img('wide-leg') }, { id: 'p2b', media_type: 'IMAGE', media_url: img('satin-blouse') }] } },
  { id: 'p3', media_type: 'VIDEO', thumbnail_url: img('denim-jacket'), media_url: '/demo/none.mp4', permalink: 'https://www.instagram.com/reel/fake3/', timestamp: h(20),
    caption: 'Cropped denim jacket sz 12 1,400 bob. Mint condition 👌' },
  { id: 'p4', media_type: 'IMAGE', media_url: img('linen-midi'), permalink: 'https://www.instagram.com/p/fake4/', timestamp: h(5),
    caption: 'Still available!! Linen midi now 800 😍 size 10' },
  { id: 'p5', media_type: 'IMAGE', media_url: img('floral-wrap'), permalink: 'https://www.instagram.com/p/fake5/', timestamp: h(18),
    caption: 'SOLD ❌ Floral wrap dress' },
  { id: 'p6', media_type: 'IMAGE', media_url: img('bale-announcement'), permalink: 'https://www.instagram.com/p/fake6/', timestamp: h(10),
    caption: 'New bale opening Sunday 9am at the stall! Come early 🔥🔥' },
  { id: 'p7', media_type: 'IMAGE', media_url: img('dark-blurry'), permalink: 'https://www.instagram.com/p/fake7/', timestamp: h(8),
    caption: 'dress 700 sz 14' },
  { id: 'p8', media_type: 'IMAGE', media_url: img('linen-shorts'), permalink: 'https://www.instagram.com/p/fake8/', timestamp: h(4),
    caption: '250 | linen shorts | 450' },
  { id: 'p10', media_type: 'IMAGE', media_url: img('wide-leg-b'), permalink: 'https://www.instagram.com/p/fake10/', timestamp: h(1),
    caption: 'Wide leg trousers back in stock! size 10, 950' },
  { id: 'p9', media_type: 'IMAGE', media_url: img('mom-jeans'), permalink: 'https://www.instagram.com/p/fake9/', timestamp: h(2),
    caption: 'Mom jeans, light wash. W32 🤍' },
];

function media() {
  return { data: POSTS.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)), paging: {} };
}

module.exports = { media, POSTS };
