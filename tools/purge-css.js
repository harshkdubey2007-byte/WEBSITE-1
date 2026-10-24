// Drops style rules that no page of the site can match from the big route stylesheets in _next/static/css.
//
//   node tools/purge-css.js            writes the slimmed files next to the originals as <name>.purged.css and prints the savings
//   node tools/purge-css.js --apply    replaces the originals with the slimmed files (git has the originals)
//
// How it decides (kept on purpose generous): the pages that load a stylesheet are opened in headless Chrome (a local server
// must be running) at phone and desktop width, and every selector is asked "does any element match?". The parts of a selector
// that only apply in a moment (:hover, ::before, .active, .open, :not(...)) are removed before asking, and any rule that names
// a menu, modal, form, slider and the like is kept whatever the answer. @font-face, @import and animations that are still
// referenced are kept.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const BASE = "http://localhost:3000";
const APPLY = process.argv.includes("--apply");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// stylesheet -> pages that load it (taken from the html itself)
function pagesPerSheet() {
  const map = {};
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      if (["node_modules", ".git", "_next", "images", "api", "admin", "dashboard"].includes(f) || f.startsWith("deen3")) continue;
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith(".html")) continue;
      const rel = path.relative(ROOT, p).split(path.sep).join("/");
      if (rel.startsWith("blog/wp-content")) continue;
      const h = fs.readFileSync(p, "utf8");
      for (const m of h.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]*_next\/static\/css\/([0-9a-f]+\.css))"/g)) {
        const full = path.join(path.dirname(rel) === "." ? "" : path.dirname(rel), m[1]).split(path.sep).join("/");
        const file = m[1].startsWith("/") ? m[1].slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
        const url = "/" + (rel === "index.html" ? "" : rel.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, ""));
        (map[file] = map[file] || new Set()).add(rel === "404.html" ? null : url);
      }
    }
  })(ROOT);
  for (const k of Object.keys(map)) map[k].delete(null);
  return map;
}

// ---- css parsing (just enough to cut rules out and put the rest back unchanged) --------------------------------------------
function skipString(t, i) { const q = t[i]; i++; while (i < t.length && t[i] !== q) { if (t[i] === "\\") i++; i++; } return i + 1; }
function skipComment(t, i) { const e = t.indexOf("*/", i + 2); return e < 0 ? t.length : e + 2; }
// index of the character that closes the block that opens at t[i] === "{"
function matchBrace(t, i) {
  let d = 0;
  for (; i < t.length; i++) {
    const c = t[i];
    if (c === '"' || c === "'") { i = skipString(t, i) - 1; continue; }
    if (c === "/" && t[i + 1] === "*") { i = skipComment(t, i) - 1; continue; }
    if (c === "(") { // url( ... ) may hold braces and semicolons in a data uri
      let p = 1; i++;
      while (i < t.length && p) { if (t[i] === '"' || t[i] === "'") { i = skipString(t, i); continue; } if (t[i] === "(") p++; else if (t[i] === ")") p--; i++; }
      i--; continue;
    }
    if (c === "{") d++; else if (c === "}") { d--; if (!d) return i; }
  }
  return t.length - 1;
}
function parse(t, from, to) {
  const nodes = []; let i = from;
  while (i < to) {
    while (i < to && /\s/.test(t[i])) i++;
    if (i >= to) break;
    if (t[i] === "/" && t[i + 1] === "*") { i = skipComment(t, i); continue; }
    const start = i;
    // prelude up to { or ;
    let j = i, paren = 0;
    for (; j < to; j++) {
      const c = t[j];
      if (c === '"' || c === "'") { j = skipString(t, j) - 1; continue; }
      if (c === "/" && t[j + 1] === "*") { j = skipComment(t, j) - 1; continue; }
      if (c === "(") paren++; else if (c === ")") paren--;
      else if (paren === 0 && (c === "{" || c === ";")) break;
    }
    if (j >= to || t[j] === ";") { nodes.push({ kind: "stmt", text: t.slice(start, Math.min(j + 1, to)) }); i = j + 1; continue; }
    const prelude = t.slice(start, j).trim(); const end = matchBrace(t, j);
    if (prelude[0] === "@") {
      const name = /^@([a-zA-Z-]+)/.exec(prelude)[1].toLowerCase();
      if (/^(media|supports|layer|container|document|-moz-document)$/.test(name)) nodes.push({ kind: "group", prelude, children: parse(t, j + 1, end) });
      else nodes.push({ kind: "opaque", name, prelude, text: t.slice(start, end + 1) });
    } else nodes.push({ kind: "rule", sel: prelude, body: t.slice(j + 1, end) });
    i = end + 1;
  }
  return nodes;
}
function splitSelectors(s) {
  const out = []; let d = 0, b = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'") { const e = skipString(s, i); cur += s.slice(i, e); i = e - 1; continue; }
    if (c === "(") d++; else if (c === ")") d--; else if (c === "[") b++; else if (c === "]") b--;
    if (c === "," && !d && !b) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---- what to ask the browser, and what to keep without asking ---------------------------------------------------------------
const STATE_CLASS = "(?:active|open|opened|show|shown|showing|on|in|out|is-[\\w-]+|has-[\\w-]+|js|no-js|collapsed|collapsing|collapse|disabled|selected|current|visible|hidden|fade|loaded|loading|sticky|fixed|scrolled|scroll-[\\w-]+|expanded|focus|hover|checked|error|success|valid|invalid|dragging|playing|paused|ready|done|animate[d]?|aos-[\\w-]+|slick-[\\w-]+|swiper-[\\w-]+|lb-[\\w-]+|ebfq-[\\w-]+|eb-[\\w-]+-js)";
const KEEP_WORDS = /(modal|popup|pop-up|dropdown|drawer|overlay|tooltip|toast|menu|mega|nav|slick|swiper|carousel|slider|accordion|offcanvas|hamburger|lead|form|alert|dialog|video|player|marquee|loader|spinner|skeleton|cookie|sidebar|search|select|enquiry|iq-|wsc-|ebfq|eb-)/i;
function strip(sel) {
  let s = sel.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "\u0002");
  s = s.replace(/::?(?:before|after|first-line|first-letter|selection|placeholder|marker|backdrop|file-selector-button|cue|-webkit-[\w-]+(?:\([^)]*\))?|-moz-[\w-]+(?:\([^)]*\))?|-ms-[\w-]+)/gi, "\u0002");
  s = s.replace(/:(?:hover|focus|focus-within|focus-visible|active|visited|link|target|checked|disabled|enabled|invalid|valid|required|optional|placeholder-shown|read-only|read-write|indeterminate|default|in-range|out-of-range|fullscreen|autofill|any-link|user-invalid|user-valid|defined|open|modal|popover-open|picture-in-picture)/gi, "\u0002");
  s = s.replace(new RegExp("\\.(?:" + STATE_CLASS + ")(?![\\w-])", "g"), "\u0002");
  s = s.replace(/(^|[\s>+~(,])\u0002+(?=$|[\s>+~),])/g, "$1*").replace(/\u0002/g, "");
  s = s.trim().replace(/[\s>+~]+$/, "");
  return s || "*";
}
function needsAsk(part) { return /[.#\[]/.test(part) && !KEEP_WORDS.test(part); }

(async () => {
  const sheetPages = pagesPerSheet();
  const targets = Object.entries(sheetPages).map(([file, pages]) => ({ file, pages: [...pages] })).filter((x) => {
    const p = path.join(ROOT, x.file); return fs.existsSync(p) && fs.statSync(p).size > 500 * 1024 && x.pages.length;
  });
  if (!targets.length) { console.log("no big stylesheets found"); return; }
  console.log("stylesheets:", targets.map((x) => x.file + " (" + x.pages.length + " pages)").join(", "));

  const PROFILE = path.join(process.env.TEMP || ".", "purge-css-profile");
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=9344", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + PROFILE, "about:blank"], { stdio: "ignore" });
  await sleep(2500);
  const list = await (await fetch("http://127.0.0.1:9344/json")).json();
  const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result; if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  await send("Page.enable");

  // every text file's words, to tell whether an animation name is still referred to
  const otherText = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { if (["node_modules", ".git", "images"].includes(f) || f.startsWith("deen3")) continue; const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(html|js)$/.test(f) && fs.statSync(p).size < 25e6) otherText.push(fs.readFileSync(p, "utf8")); } })(ROOT);

  const summary = [];
  for (const tg of targets) {
    const src = fs.readFileSync(path.join(ROOT, tg.file), "utf8");
    const ast = parse(src, 0, src.length);
    // collect the questions
    const asks = new Map();
    (function collect(nodes) {
      for (const n of nodes) {
        if (n.kind === "group") collect(n.children);
        else if (n.kind === "rule") for (const part of splitSelectors(n.sel)) if (needsAsk(part)) asks.set(part, strip(part));
      }
    })(ast);
    const stripped = [...new Set(asks.values())];
    const matched = new Set();
    const scenarios = [];
    for (const page of tg.pages) for (const w of [1440, 390]) scenarios.push({ page, w });
    for (const sc of scenarios) {
      await send("Emulation.setDeviceMetricsOverride", { width: sc.w, height: 900, deviceScaleFactor: 1, mobile: sc.w < 700 });
      await send("Page.navigate", { url: BASE + sc.page }); await sleep(sc.page.startsWith("/online") || sc.page === "/" || /course/.test(sc.page) ? 9000 : 4500);
      await ev("(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,50))}scrollTo(0,0)})()");
      // open the usual pop-up things once so their elements exist
      await ev("(()=>{try{document.querySelectorAll('.mobile-hamburgur button,.hamburger,[class*=hamburg]').forEach(b=>b.click())}catch(e){}})()");
      await sleep(400);
      const hit = await ev("(()=>{const L=" + JSON.stringify(stripped) + ";const o=[];for(let i=0;i<L.length;i++){let h=false;try{h=!!document.querySelector(L[i])}catch(e){h=true}if(h)o.push(i)}return o})()");
      hit.forEach((i) => matched.add(stripped[i]));
      process.stdout.write(".");
    }
    console.log(" " + tg.file + ": asked " + stripped.length + " selectors, " + matched.size + " matched somewhere");

    // rebuild: keep a selector part if it was not asked or something matched it
    const keepPart = (part) => !needsAsk(part) || matched.has(asks.get(part));
    const keptRuleText = [];
    function render(nodes) {
      let out = "";
      for (const n of nodes) {
        if (n.kind === "stmt" || n.kind === "opaque") { out += n.text + (n.kind === "stmt" && !n.text.endsWith(";") ? ";" : ""); continue; }
        if (n.kind === "group") { const inner = render(n.children); if (inner) out += n.prelude + "{" + inner + "}"; continue; }
        const parts = splitSelectors(n.sel).filter(keepPart);
        if (parts.length) { const r = parts.join(",") + "{" + n.body + "}"; out += r; keptRuleText.push(r); }
      }
      return out;
    }
    // keyframes: drop the ones nothing refers to (a name in the kept rules, in a script, or in a page)
    let out = render(ast.filter((n) => n.kind !== "opaque" || !/keyframes$/.test(n.name)));
    const kfNodes = [];
    for (const n of ast) if (n.kind === "opaque" && /keyframes$/.test(n.name)) kfNodes.push(n);
    const referenced = (name) => out.includes(name) || otherText.some((t) => t.includes(name));
    let kfKept = 0;
    // keyframes sit at the top level or inside @media groups; put kept ones back at the end of the file (order only matters for same names)
    const kfOut = [];
    for (const n of kfNodes) { const name = (/@[\w-]*keyframes\s+([^\s{]+)/.exec(n.prelude) || [])[1]; if (name && referenced(name)) { kfOut.push(n.text); kfKept++; } }
    out += kfOut.join("");
    const dst = path.join(ROOT, tg.file.replace(/\.css$/, ".purged.css"));
    fs.writeFileSync(dst, out);
    summary.push({ file: tg.file, before: src.length, after: out.length, kf: kfKept + "/" + kfNodes.length });
  }
  console.log("");
  summary.forEach((s) => console.log(s.file.padEnd(60), Math.round(s.before / 1024) + "KB -> " + Math.round(s.after / 1024) + "KB  (" + Math.round(100 * (1 - s.after / s.before)) + "% smaller, keyframes kept " + s.kf + ")"));
  if (APPLY) { for (const s of summary) fs.renameSync(path.join(ROOT, s.file.replace(/\.css$/, ".purged.css")), path.join(ROOT, s.file)); console.log("applied"); }
  ws.close(); chrome.kill();
})().catch((e) => { console.error(e); process.exit(1); });
