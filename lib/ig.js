// Instagram API with Instagram Login. Docs: developers.facebook.com/docs/instagram-platform
// Set FAKE_IG=1 on a computer to test without Instagram: it returns a pretend shop and posts.
const VERSION = process.env.IG_API_VERSION || 'v25.0';
const GRAPH = 'https://graph.instagram.com';
const SCOPES = ['instagram_business_basic'];

const fake = () => process.env.FAKE_IG === '1' && !process.env.VERCEL;

function authUrl(redirectUri, state) {
  if (fake()) return '/api/auth/callback?code=fake&state=' + encodeURIComponent(state);
  const p = new URLSearchParams({
    client_id: process.env.IG_APP_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
  });
  return 'https://www.instagram.com/oauth/authorize?' + p.toString();
}

async function getJson(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  if (!r.ok || data.error) {
    const msg = (data.error && (data.error.message || data.error_message)) || data.error_message || ('Instagram error ' + r.status);
    const err = new Error(msg);
    err.status = r.status;
    err.ig = data.error || data;
    throw err;
  }
  return data;
}

async function exchangeCode(code, redirectUri) {
  if (fake()) return { access_token: 'fake-token', user_id: 'fake_' + (process.env.FAKE_IG_USER || 'mtumba_queen') };
  const body = new URLSearchParams({
    client_id: process.env.IG_APP_ID || '',
    client_secret: process.env.IG_APP_SECRET || '',
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const d = await getJson('https://api.instagram.com/oauth/access_token', { method: 'POST', body });
  const row = Array.isArray(d.data) ? d.data[0] : d;
  return { access_token: row.access_token, user_id: String(row.user_id) };
}

async function longLived(shortToken) {
  if (fake()) return { access_token: 'fake-long-token', expires_in: 60 * 86400 };
  const p = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: process.env.IG_APP_SECRET || '', access_token: shortToken });
  return getJson(GRAPH + '/access_token?' + p.toString());
}

async function refresh(token) {
  if (fake()) return { access_token: token, expires_in: 60 * 86400 };
  const p = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
  return getJson(GRAPH + '/refresh_access_token?' + p.toString());
}

async function profile(token) {
  if (fake()) {
    const u = process.env.FAKE_IG_USER || 'mtumba_queen';
    return { user_id: 'fake_' + u, username: u, name: u.replace(/_/g, ' '), account_type: 'BUSINESS', followers_count: 4200, media_count: 6 };
  }
  const fields = 'user_id,username,name,account_type,profile_picture_url,followers_count,media_count';
  return getJson(GRAPH + '/' + VERSION + '/me?fields=' + fields + '&access_token=' + encodeURIComponent(token));
}

async function media(token, after) {
  if (fake()) return require('./fakeig').media(after);
  const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}';
  let url = GRAPH + '/' + VERSION + '/me/media?fields=' + encodeURIComponent(fields) + '&limit=25&access_token=' + encodeURIComponent(token);
  if (after) url += '&after=' + encodeURIComponent(after);
  return getJson(url);
}

async function download(url) {
  if (fake() && url.startsWith('/')) {
    const fs = require('fs');
    const path = require('path');
    return fs.readFileSync(path.join(process.cwd(), 'public', url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error('Could not download photo (' + r.status + ')');
  return Buffer.from(await r.arrayBuffer());
}

module.exports = { authUrl, exchangeCode, longLived, refresh, profile, media, download, fake };
