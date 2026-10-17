/* Competitor Analysis Kit API for /resources/competitor-analysis:
     GET /api/site-info?url=competitor.com
   Reads one public website's home page (plus robots.txt, its sitemap and the
   public RDAP domain record) and reports facts we can measure honestly: speed,
   size, domain age, pages in the sitemap, platform, analytics and ad pixels,
   social profiles, contact options and on-page SEO basics. It never estimates
   traffic. Same safety limits as check-links.js (see _lib/safe-fetch.js). */
"use strict";
const { request, cancel, readText, rateLimiter, send } = require("./_lib/safe-fetch");

const limited = rateLimiter(20);
const MAX_HTML = 3 * 1024 * 1024;

const TECH = [
  ["WordPress", /\/wp-content\/|\/wp-includes\/|<meta[^>]+generator[^>]+WordPress/i],
  ["WooCommerce", /wp-content\/plugins\/woocommerce|woocommerce-no-js|wc-block/i], ["Elementor", /wp-content\/plugins\/elementor|elementor-frontend/i], ["Shopify", /cdn\.shopify\.com|Shopify\.theme/i],
  ["Wix", /static\.wixstatic\.com|wix-bolt|_wixCssImports/i], ["Squarespace", /static1\.squarespace\.com|squarespace-cdn/i],
  ["Webflow", /data-wf-site|webflow\.js/i], ["Next.js", /\/_next\/static|__NEXT_DATA__/], ["Nuxt", /__NUXT__|\/_nuxt\//],
  ["Gatsby", /___gatsby/], ["Angular", /ng-version=/], ["Joomla", /\/media\/jui\/|<meta[^>]+generator[^>]+Joomla/i],
  ["Drupal", /Drupal\.settings|\/sites\/default\/files\//], ["Magento", /Mage\.Cookies|\/static\/version\d+\/frontend\//],
  ["Blogger", /blogger\.com\/static|\.blogspot\.com/], ["Bootstrap", /bootstrap(\.min)?\.(css|js)/i], ["jQuery", /jquery(\.min)?\.js/i], ["Tailwind CSS", /cdn\.tailwindcss\.com|tailwind(\.min)?\.css/i]
];
const TRACK = [
  ["Google Analytics 4", /gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/], ["Google Tag Manager", /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/],
  ["Google Ads tag", /AW-\d{6,}|googleadservices\.com\/pagead\/conversion/], ["Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/],
  ["LinkedIn Insight", /snap\.licdn\.com|_linkedin_partner_id/], ["TikTok Pixel", /analytics\.tiktok\.com/], ["Microsoft Clarity", /clarity\.ms\/tag/],
  ["Hotjar", /static\.hotjar\.com|hjid/], ["Microsoft Ads (UET)", /bat\.bing\.com/], ["Twitter/X Pixel", /static\.ads-twitter\.com/],
  ["Snapchat Pixel", /sc-static\.net\/scevent/], ["Pinterest Tag", /s\.pinimg\.com\/ct\/core\.js/], ["HubSpot", /js\.hs-scripts\.com|js\.hsforms\.net/],
  ["Zoho", /salesiq\.zoho|zohopublic|zoho\.com\/crm/i], ["Mailchimp", /chimpstatic\.com|list-manage\.com/], ["Tawk.to chat", /embed\.tawk\.to/],
  ["Intercom", /widget\.intercom\.io/], ["Crisp chat", /client\.crisp\.chat/], ["Razorpay", /checkout\.razorpay\.com/], ["Google reCAPTCHA", /recaptcha/i]
];
const ADS = ["Google Ads tag", "Meta Pixel", "LinkedIn Insight", "TikTok Pixel", "Microsoft Ads (UET)", "Twitter/X Pixel", "Snapchat Pixel", "Pinterest Tag"];
const SOCIAL = [["Instagram", /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/)[A-Za-z0-9_.]+/i], ["Facebook", /https?:\/\/(?:www\.|m\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr\b|tr\?)[A-Za-z0-9_.\-\/]+/i],
  ["YouTube", /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_\-.]+/i], ["LinkedIn", /https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_\-.%]+/i],
  ["X (Twitter)", /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!share|intent|home)[A-Za-z0-9_]+/i], ["Pinterest", /https?:\/\/(?:[a-z]+\.)?pinterest\.[a-z.]+\/(?!pin\/create)[A-Za-z0-9_]+/i], ["Threads", /https?:\/\/(?:www\.)?threads\.net\/@[A-Za-z0-9_.]+/i]];

function attr(html, re) { const m = html.match(re); return m ? m[1].replace(/\s+/g, " ").trim() : ""; }
function decode(s) { return (s || "").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " "); }

async function sitemapCount(origin, robots) {
  const urls = [];
  (robots.match(/^\s*sitemap:\s*(\S+)/gim) || []).forEach(l => urls.push(l.replace(/^\s*sitemap:\s*/i, "").trim()));
  if (!urls.length) urls.push(origin + "/sitemap.xml", origin + "/sitemap_index.xml");
  for (const u of urls.slice(0, 3)) {
    const r = await request(u, "GET", 7000);
    if (r.error || r.status !== 200) { cancel(r.res); continue; }
    const xml = (await readText(r.res, 4 * 1024 * 1024)).text;
    if (/<sitemapindex/i.test(xml)) {
      const kids = (xml.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, "").trim());
      let total = 0, read = 0;
      for (const k of kids.slice(0, 6)) {
        const kr = await request(k, "GET", 6000);
        if (kr.error || kr.status !== 200) { cancel(kr.res); continue; }
        total += ((await readText(kr.res, 4 * 1024 * 1024)).text.match(/<loc>/gi) || []).length;
        read++;
      }
      if (read) return { count: total, approx: kids.length > read, sitemaps: kids.length, url: u };
    } else {
      const n = (xml.match(/<loc>/gi) || []).length;
      if (n) return { count: n, approx: false, sitemaps: 1, url: u };
    }
  }
  return null;
}

/* Domain registration date from the official registry (RDAP), found through IANA's bootstrap list. */
let boot = null, bootAt = 0;
async function rdapBase(tld) {
  if (!boot || Date.now() - bootAt > 864e5) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
    try { boot = await (await fetch("https://data.iana.org/rdap/dns.json", { signal: c.signal })).json(); bootAt = Date.now(); } catch (e) { boot = null; } finally { clearTimeout(t); }
  }
  if (!boot) return null;
  const svc = (boot.services || []).find(x => x[0].includes(tld));
  return svc ? svc[1][0].replace(/\/?$/, "/") : null;
}
async function domainAge(host) {
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const tld = parts[parts.length - 1];
  const second = /^(co|com|net|org|gov|ac|edu|gen|firm|ind|ltd|plc|nic|res)$/i.test(parts[parts.length - 2]) && tld.length === 2;
  const domain = parts.slice(second ? -3 : -2).join(".");
  const base = await rdapBase(tld);
  if (!base) return null;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 7000);
    const r = await fetch(base + "domain/" + encodeURIComponent(domain), { signal: c.signal, headers: { accept: "application/rdap+json, application/json" } });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const ev = (j.events || []).find(e => /registration/i.test(e.eventAction));
    return ev && ev.eventDate ? { domain, registered: ev.eventDate.slice(0, 10) } : null;
  } catch (e) { return null; }
}

module.exports = async function (req, res) {
  const q = new URL(req.url, "http://x").searchParams;
  let target = (q.get("url") || "").trim();
  if (!target) return send(res, 400, { error: "Please enter a website." });
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;
  let start;
  try { start = new URL(target); } catch (e) { return send(res, 400, { error: "That does not look like a valid website." }); }
  if (limited(req)) return send(res, 429, { error: "Too many checks in a minute. Please wait a little and try again." });

  const page = await request(start.href, "GET", 12000);
  if (page.error) return send(res, 400, { error: page.error === "Blocked or unknown host" ? "We could not find that website." : "We could not open that website (" + page.error.toLowerCase() + ")." });
  const headers = page.res.headers;
  const type = headers.get("content-type") || "";
  if (!/html/i.test(type)) { cancel(page.res); return send(res, 400, { error: "That link is not a web page." }); }
  const body = await readText(page.res, MAX_HTML);
  const html = body.text, final = new URL(page.finalUrl), origin = final.origin;

  const [robotsR, age] = await Promise.all([request(origin + "/robots.txt", "GET", 6000), domainAge(final.hostname.replace(/^www\./, ""))]);
  let robots = "";
  if (!robotsR.error && robotsR.status === 200 && /text\/plain/i.test(robotsR.res.headers.get("content-type") || "")) robots = (await readText(robotsR.res, 200000)).text; else cancel(robotsR.res);
  const sitemap = await sitemapCount(origin, robots);

  const clean = html.replace(/<!--[\s\S]*?-->/g, "");
  const text = clean.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const words = (decode(text).match(/[A-Za-zऀ-ॿ0-9]+/g) || []).length;
  const hrefs = [...clean.matchAll(/<a\s[^>]*?href\s*=\s*["']([^"']+)["']/gi)].map(m => decode(m[1]));
  let internal = 0, external = 0;
  hrefs.forEach(h => { try { const u = new URL(h, final.href); if (!/^https?:$/.test(u.protocol)) return; if (u.hostname.replace(/^www\./, "") === final.hostname.replace(/^www\./, "")) internal++; else external++; } catch (e) {} });
  const social = {};
  SOCIAL.forEach(([n, re]) => { const h = hrefs.find(x => re.test(x)); if (h) social[n] = h.split("?")[0]; });
  const wa = hrefs.find(h => /wa\.me\/|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send/i.test(h));
  const tel = hrefs.find(h => /^tel:/i.test(h)), mail = hrefs.find(h => /^mailto:/i.test(h));
  const ld = [];
  (clean.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []).forEach(s => {
    try { const j = JSON.parse(s.replace(/^<script[^>]*>|<\/script>$/gi, "")); (Array.isArray(j) ? j : (j["@graph"] || [j])).forEach(x => { const t = x && x["@type"]; if (t) ld.push([].concat(t).join(", ")); }); } catch (e) { ld.push("Invalid JSON-LD"); }
  });
  const headerStr = [...headers.entries()].map(([k, v]) => k + ": " + v).join("\n");
  const tech = TECH.filter(([, re]) => re.test(html)).map(([n]) => n);
  const host = /cloudflare/i.test(headers.get("server") || "") || headers.get("cf-ray") ? "Cloudflare" : headers.get("x-vercel-id") ? "Vercel" : /netlify/i.test(headers.get("server") || "") || headers.get("x-nf-request-id") ? "Netlify" : /awselb|cloudfront|amazons3/i.test(headerStr) ? "Amazon Web Services" : headers.get("x-github-request-id") ? "GitHub Pages" : /litespeed/i.test(headers.get("server") || "") ? "LiteSpeed server" : /nginx/i.test(headers.get("server") || "") ? "Nginx server" : /apache/i.test(headers.get("server") || "") ? "Apache server" : "";
  const trackers = TRACK.filter(([, re]) => re.test(html)).map(([n]) => n);

  send(res, 200, {
    input: target, url: final.href, host: final.hostname, https: final.protocol === "https:", status: page.status, redirects: page.chain,
    ms: page.ms, kb: Math.round(body.bytes / 1024), cut: body.cut,
    title: decode(attr(clean, /<title[^>]*>([\s\S]*?)<\/title>/i)).slice(0, 200),
    description: decode(attr(clean, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || attr(clean, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)).slice(0, 320),
    h1: decode(attr(clean, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 160),
    h1Count: (clean.match(/<h1[\s>]/gi) || []).length, words, lang: attr(clean, /<html[^>]+lang=["']([^"']+)["']/i),
    ogImage: attr(clean, /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i),
    siteName: decode(attr(clean, /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)).slice(0, 60),
    internalLinks: internal, externalLinks: external, images: (clean.match(/<img\s/gi) || []).length,
    blog: hrefs.some(h => /\/(blog|news|articles|insights|resources)(\/|$|\?)/i.test(h)), pricing: hrefs.some(h => /\/(pricing|prices|plans|fees|packages)(\/|$|\?)/i.test(h)),
    schema: [...new Set(ld)], tech, hosting: host, trackers, ads: trackers.filter(t => ADS.includes(t)),
    social, whatsapp: !!wa, phone: tel ? tel.replace(/^tel:/i, "") : "", email: mail ? mail.replace(/^mailto:/i, "").split("?")[0] : "",
    robots: !!robots, sitemap, domain: age
  });
};
