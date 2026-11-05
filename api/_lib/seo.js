/* Yoast-style SEO check for one page's HTML. Pure functions, no network.
   analyze(html, { path, keyword }) -> { score, status, checks: [...] }
   Each check is { id, group, status: "good" | "ok" | "bad", title, text }.
   Score = good 1, ok 0.5, bad 0, as a percentage. >= 80 good, >= 50 ok, else bad. */
"use strict";

const strip = s => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&#x27;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const attr = (tag, name) => { const m = new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i").exec(tag); return m ? (m[1] !== undefined ? m[1] : m[2]) : ""; };
const meta = (html, key, by) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) if (attr(m[0], by || "name").toLowerCase() === key) return attr(m[0], "content");
  return "";
};
const words = s => (s.match(/[\p{L}\p{N}'’-]+/gu) || []);
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();

function analyze(html, opts) {
  opts = opts || {};
  const checks = [];
  const add = (group, id, status, title, text) => checks.push({ id, group, status, title, text });

  const title = strip((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "");
  const desc = strip(meta(html, "description"));
  const robots = meta(html, "robots").toLowerCase();
  const canonical = (/<link\b[^>]*rel=["']canonical["'][^>]*>/i.exec(html) || [""])[0];
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html) || [, html])[1];
  const clean = body.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ");
  const main = (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(clean) || [, clean.replace(/<(header|footer|nav)\b[\s\S]*?<\/\1>/gi, " ")])[1];
  const text = strip(main);
  const count = words(text).length;
  const h1s = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => strip(m[1])).filter(Boolean);
  const h2s = [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => strip(m[1])).filter(Boolean);
  const imgs = [...main.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  /* A missing alt attribute is a problem; alt="" is a deliberate "decorative image". */
  const noAlt = imgs.filter(t => !/\salt\s*=/i.test(t));
  const links = [...main.matchAll(/<a\b[^>]*>/gi)].map(m => attr(m[0], "href")).filter(h => h && !/^(#|mailto:|tel:|javascript:)/i.test(h));
  const external = links.filter(h => /^https?:\/\//i.test(h) && !/(^https?:\/\/)?(www\.)?ebuddha\.in/i.test(h));
  const internal = links.length - external.length;
  const firstPara = strip((/<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(main) || [])[1] || "");
  const slug = (opts.path || "").replace(/(^|\/)index\.html$/, "").replace(/\.html?$/, "");

  /* ---- Problems that block ranking ---- */
  if (/noindex/.test(robots)) add("Indexing", "noindex", "bad", "Page is hidden from Google", "This page has a noindex robots tag, so search engines will not list it.");
  else add("Indexing", "noindex", "good", "Page can be indexed", "No noindex tag found.");
  add("Indexing", "canonical", canonical ? "good" : "bad", canonical ? "Canonical URL set" : "No canonical URL", canonical ? "A canonical link tells Google the preferred address." : "Add a canonical link to avoid duplicate-content issues.");

  /* ---- Title ---- */
  const tl = title.length;
  if (!tl) add("Snippet", "title", "bad", "No SEO title", "Add a <title>. It is the main text shown in search results.");
  else if (tl < 30) add("Snippet", "title", "ok", "SEO title is short", "The title is " + tl + " characters. Aim for 30 to 60.");
  else if (tl > 60) add("Snippet", "title", tl > 70 ? "bad" : "ok", "SEO title is long", "The title is " + tl + " characters. Google may cut it off after about 60.");
  else add("Snippet", "title", "good", "SEO title length is good", "The title is " + tl + " characters.");

  /* ---- Meta description ---- */
  const dl = desc.length;
  if (!dl) add("Snippet", "desc", "bad", "No meta description", "Write a 120 to 160 character summary. It is shown under your title in search results.");
  else if (dl < 120) add("Snippet", "desc", "ok", "Meta description is short", "It is " + dl + " characters. Aim for 120 to 160.");
  else if (dl > 160) add("Snippet", "desc", dl > 200 ? "bad" : "ok", "Meta description is long", "It is " + dl + " characters. Google may cut it off after about 160.");
  else add("Snippet", "desc", "good", "Meta description length is good", "It is " + dl + " characters.");

  if (slug) {
    const sl = slug.length;
    add("Snippet", "slug", sl > 75 ? "bad" : sl > 50 ? "ok" : "good", sl > 50 ? "URL is long" : "URL length is good", "/" + slug + (sl > 50 ? " is " + sl + " characters. Shorter addresses are easier to read and share." : ""));
  }

  /* ---- Content ---- */
  if (count >= 300) add("Content", "length", "good", "Enough text", "The page has about " + count + " words.");
  else if (count >= 150) add("Content", "length", "ok", "Text is a little thin", "The page has about " + count + " words. Aim for at least 300 on pages you want to rank.");
  else add("Content", "length", "bad", "Very little text", "The page has about " + count + " words. Search engines need more text to understand it.");

  if (h1s.length === 1) add("Content", "h1", "good", "One main heading", "H1: " + h1s[0].slice(0, 80));
  else if (!h1s.length) add("Content", "h1", "bad", "No H1 heading", "Add one H1 that says what the page is about.");
  else add("Content", "h1", "ok", "More than one H1", "Found " + h1s.length + " H1 headings. Use one, and H2 for the sections.");

  add("Content", "h2", h2s.length ? "good" : count >= 300 ? "bad" : "ok", h2s.length ? "Subheadings used" : "No subheadings", h2s.length ? h2s.length + " H2 headings split up the text." : "Break the text into sections with H2 headings.");

  if (!imgs.length) add("Content", "alt", "ok", "No images", "Pages with relevant images tend to hold attention better.");
  else if (!noAlt.length) add("Content", "alt", "good", "All images have alt text", imgs.length + " images checked.");
  else add("Content", "alt", noAlt.length > imgs.length / 2 ? "bad" : "ok", noAlt.length + " of " + imgs.length + " images have no alt text", "Alt text helps image search and screen readers.");

  add("Links", "internal", internal > 0 ? "good" : "ok", internal > 0 ? "Internal links found" : "No internal links", internal > 0 ? internal + " links to other pages on the site." : "Link to related pages so visitors and Google can move around the site.");
  add("Links", "external", external.length ? "good" : "ok", external.length ? "Outbound links found" : "No outbound links", external.length ? external.length + " links to other websites." : "Linking to a trusted source can add credibility. Optional.");

  /* ---- Social and technical ---- */
  const og = meta(html, "og:title", "property") && meta(html, "og:image", "property");
  add("Social & technical", "og", og ? "good" : "ok", og ? "Social sharing tags set" : "Social sharing tags missing", og ? "Open Graph title and image found." : "Add og:title and og:image so shared links look good.");
  add("Social & technical", "schema", /application\/ld\+json/i.test(html) ? "good" : "ok", /application\/ld\+json/i.test(html) ? "Structured data found" : "No structured data", /application\/ld\+json/i.test(html) ? "JSON-LD markup is present." : "Schema markup can give you rich results in Google. Optional.");
  add("Social & technical", "lang", /<html\b[^>]*\slang=/i.test(html) ? "good" : "ok", /<html\b[^>]*\slang=/i.test(html) ? "Language declared" : "No language set", "Add a lang attribute on <html>.");

  /* ---- Focus keyphrase (only when one is given) ---- */
  const kw = norm(opts.keyword || "");
  if (kw) {
    const inT = norm(title).includes(kw), inD = norm(desc).includes(kw), inH = h1s.some(h => norm(h).includes(kw));
    const inP = norm(firstPara).includes(kw), inU = norm(slug.replace(/[-/_]+/g, " ")).includes(kw);
    add("Focus keyphrase", "kw-title", inT ? "good" : "bad", inT ? "Keyphrase in SEO title" : "Keyphrase missing from SEO title", "Put \"" + opts.keyword + "\" in the title, ideally near the start.");
    add("Focus keyphrase", "kw-desc", inD ? "good" : "bad", inD ? "Keyphrase in meta description" : "Keyphrase missing from meta description", "Mention \"" + opts.keyword + "\" in the description.");
    add("Focus keyphrase", "kw-h1", inH ? "good" : "bad", inH ? "Keyphrase in H1" : "Keyphrase missing from H1", "Use \"" + opts.keyword + "\" in the main heading.");
    add("Focus keyphrase", "kw-intro", inP ? "good" : "ok", inP ? "Keyphrase in the first paragraph" : "Keyphrase missing from the first paragraph", "Mention \"" + opts.keyword + "\" early in the text.");
    add("Focus keyphrase", "kw-url", inU ? "good" : "ok", inU ? "Keyphrase in the URL" : "Keyphrase not in the URL", "A matching address helps. Changing a live URL needs a redirect, so be careful.");
    const hits = count ? (norm(text).split(kw).length - 1) : 0, dens = count ? hits * kw.split(" ").length / count * 100 : 0;
    add("Focus keyphrase", "kw-density", hits === 0 ? "bad" : dens > 3 ? "bad" : dens < 0.5 ? "ok" : "good", hits === 0 ? "Keyphrase not used in the text" : "Keyphrase used " + hits + " time" + (hits > 1 ? "s" : "") + " (" + dens.toFixed(1) + "%)", "Aim for about 0.5% to 3% of the text.");
  }

  const pts = checks.reduce((n, c) => n + (c.status === "good" ? 1 : c.status === "ok" ? 0.5 : 0), 0);
  const score = Math.round(pts / checks.length * 100);
  return { score, status: score >= 80 ? "good" : score >= 50 ? "ok" : "bad", title, description: desc, words: count, checks };
}

module.exports = { analyze };
