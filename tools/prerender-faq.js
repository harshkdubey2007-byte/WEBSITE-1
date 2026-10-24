// Writes each page's finished FAQ (the tabbed accordion eb-faq.js builds from faq-data/*.json) into the page's own html,
// so search and AI crawlers that do not run JavaScript can read every question and answer.
//
// How: for every page, take out any earlier copy, load the page in headless Chrome (a local server must be running),
// copy the FAQ the script builds, and write it back into the source just where the page's old FAQ stands.
// eb-faq.js finds that copy ([data-ebfq-static]), wires up the tabs and accordion and moves it to its usual place.
// Run again whenever faq-data/*.json or the old FAQ markup changes:
//     node tools/prerender-faq.js [http://localhost:3000]
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const BASE = process.argv[2] || "http://localhost:3000";
const OPEN = "<!--ebfq-static-->", CLOSE = "<!--/ebfq-static-->";

// ---- the CSS constant from eb-faq.js, so the copy looks right before the script runs ------------------------------------
function readCss() {
  const src = fs.readFileSync(path.join(ROOT, "eb-faq.js"), "utf8");
  const i = src.indexOf("var CSS = ");
  const e = i + src.slice(i).search(/';\r?\n/) + 1; // the statement ends at the first  ';  that closes a quoted string and ends a line
  return new Function(src.slice(i, e) + "; return CSS;")();
}

// ---- pages ---------------------------------------------------------------------------------------------------------------
const SKIP = /^(_next|api|admin|dashboard|cdn-cgi|deen3evddmddt\.cloudfront\.net|fonts|fonts\.googleapis\.com|fonts\.gstatic\.com|images|FooterBlueBarIcons|HireFromUs|HomePageAssets|blog\/wp-content|online-digital-marketing-course\/_next|node_modules|\.git|tools\/prerender)(\/|$)/;
const pages = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), rel = path.relative(ROOT, p).split(path.sep).join("/");
    if (SKIP.test(rel)) continue;
    if (fs.statSync(p).isDirectory()) walk(p); else if (/\.html$/.test(f)) pages.push(rel);
  }
})(ROOT);
const urlOf = (rel) => "/" + rel.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "");

// ---- where the old FAQ starts in the source, and which tags are the old FAQ -----------------------------------------------
function tagStart(s, i) { return s.lastIndexOf("<", i); }
function locate(fmt, s) {
  if (fmt === "yoast") { const m = /class="[^"]*(wp-block-yoast-faq-block|schema-faq)\b/.exec(s); if (!m) return null; const a = tagStart(s, m.index); return { at: a, old: [a] }; }
  if (fmt === "wsc") {
    const re = /<details\b[^>]*wsc-faq-item[^>]*>/g; const olds = []; let m; while ((m = re.exec(s))) olds.push(m.index);
    return olds.length ? { at: olds[0], old: olds } : null;
  }
  if (fmt === "course") {
    const i = s.indexOf("offline-faq-border-box"); if (i < 0) return null;
    let a = s.lastIndexOf("<section", i);
    const w = /<div id="section-[^"]*"[^>]*>\s*$/.exec(s.slice(Math.max(0, a - 160), a));
    if (w) a = a - (s.slice(Math.max(0, a - 160), a).length - w.index);
    return { at: a, old: [a] };
  }
  if (fmt === "services") { const m = /<section\b[^>]*class="[^"]*\beb-faq\b[^"]*"[^>]*>/.exec(s); return m ? { at: m.index, old: [m.index] } : null; }
  if (fmt === "rf") { const i = s.indexOf('id="rf-faq"'); return i < 0 ? null : { at: tagStart(s, i), old: [tagStart(s, i)] }; }
  return null;
}
function tagEnd(s, a) { return s.indexOf(">", a) + 1; }

// ---- headless Chrome -------------------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CAPTURE = `(async function(){
  for (var n = 0; n < 60 && !document.querySelector('[data-ebfq]'); n++) await new Promise(function(r){setTimeout(r,400)});
  var s = document.querySelector('[data-ebfq]'); if (!s) return null;
  var fmt = document.querySelector('.wp-block-yoast-faq-block, .schema-faq') ? 'yoast' : document.querySelectorAll('details.wsc-faq-item').length || document.querySelector('[data-ebfq-old] details.wsc-faq-item') ? 'wsc' : document.querySelector('.offline-faq-border-box') ? 'course' : document.querySelector('section.eb-faq') ? 'services' : document.querySelector('details.rf-fq') ? 'rf' : 'unknown';
  var c = s.cloneNode(true);
  var id = s.id || '';
  c.removeAttribute('id'); c.removeAttribute('data-ebfq'); c.setAttribute('data-ebfq-static', '1');
  [].forEach.call(c.querySelectorAll('.ebfq-item'), function(i){ i.classList.remove('open'); i.style.display = ''; });
  [].forEach.call(c.querySelectorAll('.ebfq-a'), function(a){ a.removeAttribute('style'); });
  [].forEach.call(c.querySelectorAll('.ebfq-tab'), function(t, i){ t.classList.toggle('on', i === 0); });
  return { fmt: fmt, id: id, html: c.outerHTML, items: c.querySelectorAll('.ebfq-item').length };
})()`;

(async () => {
  const css = readCss();
  const PROFILE = path.join(process.env.TEMP || ".", "prerender-faq-profile");
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=9340", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + PROFILE, "about:blank"], { stdio: "ignore" });
  await sleep(2500);
  const list = await (await fetch("http://127.0.0.1:9340/json")).json();
  const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  const report = [];
  for (const rel of pages) {
    const file = path.join(ROOT, rel);
    let src = fs.readFileSync(file, "utf8");
    // 1. drop an earlier copy so the page builds its FAQ from the data again
    let prevId = "";
    const a = src.indexOf(OPEN), b = src.indexOf(CLOSE);
    if (a >= 0 && b > a) {
      const pm = /<section id="([^"]*)"/.exec(src.slice(a, b)); prevId = pm ? pm[1] : "";
      src = src.slice(0, a) + src.slice(b + CLOSE.length); fs.writeFileSync(file, src);
    }
    // 2. let the page build it
    await send("Page.navigate", { url: BASE + urlOf(rel) });
    await sleep(1500);
    const r = (await send("Runtime.evaluate", { expression: CAPTURE, awaitPromise: true, returnByValue: true })).result.result.value;
    if (!r || !r.items) { report.push(rel + ": no FAQ"); continue; }
    let loc = locate(r.fmt, src);
    let fallback = false;
    if (!loc) {
      // no FAQ in the source: the page gets its questions together with the enquiry form at load time, so the copy sits above the footer
      const f = /<footer/.exec(src), end = src.lastIndexOf("</body>");
      const at = f ? f.index : end;
      if (at < 0) { report.push(rel + ": could not place (" + r.fmt + ")"); continue; }
      loc = { at, old: [] }; fallback = true;
    }
    // 3. mark the old FAQ tags (hidden by eb-faq.js css) and move an id from the old wrapper to the copy
    let carryId = r.id || prevId;
    const edits = loc.old.map((at) => ({ at, end: tagEnd(src, at) })).sort((x, y) => y.at - x.at);
    for (const e of edits) {
      let tag = src.slice(e.at, e.end);
      if (!/data-ebfq-old/.test(tag)) tag = tag.replace(/^<([a-z0-9]+)/i, '<$1 data-ebfq-old="1"');
      const idm = /\sid="([^"]*)"/.exec(tag);
      if (idm && e.at === loc.at) { carryId = carryId || idm[1]; tag = tag.replace(/\sid="[^"]*"/, ""); }
      src = src.slice(0, e.at) + tag + src.slice(e.end);
    }
    // the copy goes where the old FAQ began (marking tags only lengthened the text after loc.at)
    let html = r.html;
    if (carryId) html = html.replace(/^<section/, '<section id="' + carryId + '"');
    const block = OPEN + '<style id="ebfq-css">' + css + "</style><noscript><style>.ebfq-a{height:auto!important}</style></noscript>" + html + CLOSE;
    src = src.slice(0, loc.at) + block + src.slice(loc.at);
    fs.writeFileSync(file, src);
    report.push(rel + ": " + r.items + " questions (" + r.fmt + (fallback ? ", above footer" : "") + ")");
  }
  console.log(report.join("\n"));
  ws.close(); chrome.kill();
})().catch((e) => { console.error(e); process.exit(1); });
