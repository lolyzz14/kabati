// Reads a post with AI when ANTHROPIC_API_KEY is set; otherwise (or on any error) uses the caption rules.
const { readCaption } = require('./parse');

const MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';

const INSTRUCTIONS = `You read Instagram posts from Kenyan shops (mostly mtumba / second-hand clothes, also new clothes and home goods) and turn them into shop listings.
Reply with JSON only, no other text, in exactly this shape:
{"is_product": true|false, "sold": true|false, "photo_quality": "ok"|"low",
 "pieces": [{"photo_index": 0, "name": "", "category": "dress|top|bottom|outer|shoes|bag|home|other", "subtype": "mini|midi|maxi|shorts|skirt|jeans|trousers|null",
   "gender": "w|m|u", "size_value": "", "size_label": "", "price": 0, "condition": null, "fabric": null, "measurements": [["Length","112 cm"]],
   "seller_code": null, "unsure": []}]}
Rules:
- is_product is false for announcements, memes, quotes, behind-the-scenes or anything not offering a specific piece.
- sold is true only if the caption says the piece is sold.
- One entry in pieces per distinct piece for sale. photo_index is the 0-based photo that shows it best.
- name: short and plain, e.g. "Linen midi dress". No emojis, no prices.
- size_value: UK number as a string ("10") or letter ("M"). size_label is what buyers see, e.g. "10", "M", "10 · W32". Use null for one-size or home goods.
- price: whole Kenyan shillings as a number. Captions write prices like 900/=, 1,200 bob, KSh 850, 850sh. null if no price is written.
- condition and fabric: only if the seller wrote them. Never guess condition.
- seller_code: only if the seller numbered the piece, e.g. "No. 253" or "#253". Never confuse it with the price.
- gender "m" only for menswear, "u" for unisex, otherwise "w".
- unsure: list any of "price", "size", "category", "price_or_code", "same_piece" you could not tell for sure.
- photo_quality "low" if photos are very dark, blurry or the piece is hard to see.`;

async function readPost({ caption, images }) {
  const rules = readCaption(caption, images.length);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ...rules, photo_quality: null, by: 'rules' };
  try {
    const content = [];
    images.slice(0, 4).forEach((buf, i) => {
      content.push({ type: 'text', text: 'Photo ' + i + ':' });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } });
    });
    content.push({ type: 'text', text: 'Caption:\n' + (caption || '(no caption)') });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: INSTRUCTIONS, messages: [{ role: 'user', content }] }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data.error && data.error.message) || 'AI error ' + r.status);
    const text = (data.content || []).map((c) => c.text || '').join('');
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const pieces = (json.pieces || []).map((p) => ({
      name: String(p.name || 'Piece').slice(0, 80),
      category: ['dress', 'top', 'bottom', 'outer', 'shoes', 'bag', 'home', 'other'].includes(p.category) ? p.category : 'other',
      subtype: p.subtype && p.subtype !== 'null' ? String(p.subtype) : null,
      gender: ['w', 'm', 'u'].includes(p.gender) ? p.gender : 'w',
      size_value: p.size_value ? String(p.size_value).toUpperCase() : null,
      size_label: p.size_label ? String(p.size_label) : null,
      price: Number.isFinite(Number(p.price)) && Number(p.price) > 0 ? Math.round(Number(p.price)) : null,
      condition: p.condition || null,
      fabric: p.fabric || null,
      measurements: Array.isArray(p.measurements) ? p.measurements.filter((m) => Array.isArray(m) && m.length === 2).slice(0, 8) : [],
      seller_code: p.seller_code ? String(p.seller_code).replace(/[^0-9A-Za-z]/g, '') : null,
      photo_index: Number.isInteger(p.photo_index) ? p.photo_index : null,
      unsure: Array.isArray(p.unsure) ? p.unsure : [],
    }));
    return { is_product: !!json.is_product && pieces.length > 0, sold: !!json.sold, photo_quality: json.photo_quality || null, pieces, by: 'ai' };
  } catch (e) {
    console.error('AI read failed, using caption rules:', e.message);
    return { ...rules, photo_quality: null, by: 'rules' };
  }
}

module.exports = { readPost };
