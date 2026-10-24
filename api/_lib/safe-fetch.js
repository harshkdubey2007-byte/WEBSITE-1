/* Safe outbound fetching for the public tool APIs (check-links.js, site-info.js).
   Only public http(s) hosts are allowed: localhost, private and reserved networks
   are refused, and redirects are followed by hand so every hop is checked too. */
"use strict";
const dns = require("dns").promises;
const net = require("net");

const UA = "Mozilla/5.0 (compatible; eBuddhaTools/1.0; +https://www.ebuddha.in/tools)";

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function safeHost(host) {
  const h = host.replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (net.isIP(h)) return !privateIp(h);
  try { const all = await dns.lookup(h, { all: true }); return all.length > 0 && all.every(a => !privateIp(a.address)); } catch (e) { return false; }
}

/* One request with redirects followed by hand. Returns { status, res, finalUrl, chain, ms } or { error, chain }. */
async function request(url, method, timeout, opts) {
  opts = opts || {};
  const chain = [];
  const started = Date.now();
  let cur = url;
  for (let i = 0; i <= (opts.hops == null ? 5 : opts.hops); i++) {
    let u;
    try { u = new URL(cur); } catch (e) { return { error: "Invalid URL", chain }; }
    if (!/^https?:$/.test(u.protocol)) return { error: "Not an http link", chain };
    if (!(await safeHost(u.hostname))) return { error: "Blocked or unknown host", chain };
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    let r;
    try {
      r = await fetch(u.href, { method, redirect: "manual", signal: c.signal, headers: { "user-agent": opts.ua || UA, accept: method === "GET" ? "text/html,application/xhtml+xml,*/*" : "*/*" } });
    } catch (e) { clearTimeout(t); return { error: e.name === "AbortError" ? "Timed out" : "Could not connect", chain }; }
    clearTimeout(t);
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      chain.push(r.status);
      cancel(r);
      cur = new URL(r.headers.get("location"), u.href).href;
      continue;
    }
    return { status: r.status, res: r, finalUrl: u.href, chain, ms: Date.now() - started };
  }
  return { error: "Too many redirects", chain };
}

function cancel(r) { try { if (r && r.body && r.body.cancel) r.body.cancel(); } catch (e) {} }

/* Read a response body as text, stopping after max bytes. Returns { text, bytes, cut }. */
async function readText(res, max) {
  let text = "", bytes = 0, cut = false;
  const reader = res.body.getReader(), dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    text += dec.decode(value, { stream: true });
    if (bytes > max) { cut = true; try { reader.cancel(); } catch (e) {} break; }
  }
  return { text, bytes, cut };
}

/* Small per-instance rate limit: true when this IP made more than `limit` calls in the last minute. */
function rateLimiter(limit) {
  const hits = new Map();
  return function (req) {
    const ip = String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "").split(",")[0].trim();
    const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
    list.push(now);
    hits.set(ip, list);
    return list.length > limit;
  };
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(obj));
}

module.exports = { privateIp, safeHost, request, cancel, readText, rateLimiter, send, UA };
