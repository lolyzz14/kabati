// Small helpers for reading requests and sending answers, the same online and on a computer.
const crypto = require('crypto');

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8')); } catch (e) { return {}; } }
    return req.body;
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function send(res, status, obj, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}

function redirect(res, to, headers) {
  res.statusCode = 302;
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  res.setHeader('Location', to);
  res.end();
}

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return proto + '://' + req.headers.host;
}

function randomCode(n) {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(n);
  let s = '';
  for (let i = 0; i < n; i++) s += a[bytes[i] % a.length];
  return s;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

module.exports = { readBody, send, redirect, cookies, baseUrl, randomCode, HttpError };
