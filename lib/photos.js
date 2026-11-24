// Saves resized copies of listing photos and makes a "fingerprint" of each to spot repeat posts.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function prepare(buf) {
  const img = sharp(buf, { failOn: 'none' }).rotate();
  const full = await img.clone().resize({ width: 1080, height: 1350, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const small = await img.clone().resize({ width: 512, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
  const hash = await dhash(buf);
  const stats = await sharp(buf).stats();
  const brightness = stats.channels.slice(0, 3).reduce((t, c) => t + c.mean, 0) / 3;
  const quality = brightness < 55 || stats.sharpness < 1.2 ? 'low' : 'ok';
  return { full, small, hash, quality };
}

// Photo fingerprint: a 256-bit shape hash plus the average colours of a 4x4 grid.
// Stored as "hex|r,g,b,r,g,b,..." so old and new photos of the same piece can be compared.
async function dhash(buf) {
  const g = await sharp(buf, { failOn: 'none' }).rotate().greyscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits += g[y * 17 + x] > g[y * 17 + x + 1] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  const c = await sharp(buf, { failOn: 'none' }).rotate().removeAlpha().resize(4, 4, { fit: 'fill' }).raw().toBuffer();
  return hex + '|' + Array.from(c).join(',');
}

// 0 = identical photo, 100 = nothing alike. Same piece re-shot or re-posted is usually under 20.
function distance(a, b) {
  if (!a || !b) return 100;
  const [ha, ca] = String(a).split('|');
  const [hb, cb] = String(b).split('|');
  if (!ha || !hb || ha.length !== hb.length) return 100;
  let bits = 0;
  for (let i = 0; i < ha.length; i++) {
    let x = parseInt(ha[i], 16) ^ parseInt(hb[i], 16);
    while (x) { bits += x & 1; x >>= 1; }
  }
  const shape = bits / (ha.length * 4); // 0..1
  let colour = 0;
  if (ca && cb) {
    const A = ca.split(',').map(Number), B = cb.split(',').map(Number);
    let sum = 0;
    for (let i = 0; i < Math.min(A.length, B.length); i++) sum += Math.abs(A[i] - B[i]);
    colour = sum / Math.min(A.length, B.length) / 255; // 0..1
  }
  return Math.round((shape * 0.6 + colour * 0.4) * 100 * 2);
}

async function store(name, buf) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = require('@vercel/blob');
    const r = await put(name, buf, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: true });
    return r.url;
  }
  const dir = path.join(process.cwd(), '.data', 'blobs');
  const file = name.replace(/[^a-z0-9._-]/gi, '_');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), buf);
  return '/blob/' + file;
}

async function remove(urls) {
  if (!urls || !urls.length) return;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = require('@vercel/blob');
    await del(urls.filter((u) => /^https?:/.test(u))).catch(() => {});
  }
}

module.exports = { prepare, dhash, distance, store, remove };
