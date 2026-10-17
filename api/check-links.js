/* Broken Link Checker API for /resources/broken-link-checker:
     GET /api/check-links?url=https://example.com/page[&images=1]
   Fetches one public page, collects its links (and optionally images), and checks
   each one's HTTP status. Limits keep it cheap and safe: public http(s) addresses
   only (no localhost or private networks, checked again on every redirect), up to
   150 URLs per page, short timeouts, an overall time budget and a small per-IP
   rate limit. */
"use strict";
const { request, cancel, readText, rateLimiter, send } = require("./_lib/safe-fetch");

const MAX_URLS = 150;
const PAGE_TIMEOUT = 10000;
const LINK_TIMEOUT = 7000;
const BUDGET = 38000;
const CONCURRENCY = 12;
const MAX_HTML = 3 * 1024 * 1024;
const UA = "Mozilla/5.0 (compatible; eBuddhaLinkChecker/1.0; +https://www.ebuddha.in/resources/broken-link-checker)";
const get = (url, method, timeout) => request(url, method, timeout, { ua: UA });

async function checkUrl(url) {
  let r = await get(url, "HEAD", LINK_TIMEOUT);
  cancel(r.res);
  if (r.error || [400, 403, 405, 406, 429, 500, 501, 503].includes(r.status)) {
    const g = await get(url, "GET", LINK_TIMEOUT);
    cancel(g.res);
    if (!g.error || r.error) r = g;
  }
  return { status: r.status || 0, error: r.error || "", redirects: r.chain || [], finalUrl: r.finalUrl || "" };
}

function decode(s) { return s.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " "); }
function extract(html, pageUrl, images) {
  const baseM = html.match(/<base\s[^>]*href\s*=\s*["']([^"']+)["']/i);
  let base = pageUrl;
  try { if (baseM) base = new URL(decode(baseM[1]), pageUrl).href; } catch (e) {}
  const page = new URL(pageUrl), out = new Map();
  const add = (raw, text, kind) => {
    raw = decode((raw || "").trim());
    if (!raw || /^(#|mailto:|tel:|javascript:|data:|sms:|whatsapp:)/i.test(raw)) return;
    let u;
    try { u = new URL(raw, base); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    u.hash = "";
    const key = u.href;
    if (!out.has(key)) out.set(key, { url: key, text: text, kind: kind, internal: u.hostname.replace(/^www\./, "") === page.hostname.replace(/^www\./, ""), count: 0 });
    out.get(key).count++;
  };
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const re = /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(clean))) {
    const inner = m[4] || "", alt = (inner.match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1];
    const text = decode(inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) || (alt ? "[image] " + decode(alt) : "") || ((m[0].match(/aria-label\s*=\s*["']([^"']*)["']/i) || [])[1] || "(no text)");
    add(m[1] || m[2] || m[3], text.slice(0, 120), "link");
  }
  if (images) {
    const ri = /<img\s[^>]*?src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
    while ((m = ri.exec(clean))) add(m[1] || m[2] || m[3], ((m[0].match(/alt\s*=\s*["']([^"']*)["']/i) || [])[1] || "(image)").slice(0, 120), "image");
  }
  return [...out.values()];
}

const limited = rateLimiter(8);

module.exports = async function (req, res) {
  const started = Date.now();
  const q = new URL(req.url, "http://x").searchParams;
  let target = (q.get("url") || "").trim();
  if (!target) return send(res, 400, { error: "Please enter a page link." });
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  let pageUrl;
  try { pageUrl = new URL(target).href; } catch (e) { return send(res, 400, { error: "That does not look like a valid link." }); }
  if (limited(req)) return send(res, 429, { error: "Too many checks in a minute. Please wait a little and try again." });

  const page = await get(pageUrl, "GET", PAGE_TIMEOUT);
  if (page.error) return send(res, 400, { error: page.error === "Blocked or unknown host" ? "We could not find that website. Check the link." : "We could not open that page (" + page.error.toLowerCase() + ")." });
  if (page.status >= 400) { try { page.res.body.cancel(); } catch (e) {} return send(res, 400, { error: "That page itself returned an error (" + page.status + ")." }); }
  const type = page.res.headers.get("content-type") || "";
  if (!/html/i.test(type)) { try { page.res.body.cancel(); } catch (e) {} return send(res, 400, { error: "That link is not a web page (it is " + (type.split(";")[0] || "unknown") + ")." }); }
  let html = "";
  try { html = (await readText(page.res, MAX_HTML)).text; } catch (e) { return send(res, 400, { error: "We could not read that page." }); }

  const all = extract(html, page.finalUrl, q.get("images") === "1");
  const list = all.slice(0, MAX_URLS);
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const item = list[i++];
      if (Date.now() - started > BUDGET) { item.status = 0; item.error = "Not checked (time limit)"; item.skipped = true; continue; }
      Object.assign(item, await checkUrl(item.url));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  send(res, 200, { page: page.finalUrl, title: ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim().slice(0, 200), found: all.length, checked: list.length, results: list, seconds: Math.round((Date.now() - started) / 100) / 10 });
};
