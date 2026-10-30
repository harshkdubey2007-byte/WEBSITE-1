// Full-page screenshots of the main pages at phone, tablet and desktop width, and a pixel comparison of two sets.
//   node tools/shoot-pages.js shoot <folder>          saves <folder>/<page>-<width>.png  (local server must be running)
//   node tools/shoot-pages.js diff <folderA> <folderB>   prints how much of each picture differs
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALL = ["/", "/digital-marketing-course-in-bhopal", "/online-digital-marketing-course", "/full-stack-developer-course", "/digital-marketing-services", "/services/seo", "/services/social-media-marketing", "/services/performance-marketing", "/services/website-design-development", "/about-us", "/alumni", "/case-studies", "/contact-us", "/faq", "/hire-from-us", "/privacy-policy", "/refund-and-cancellation", "/reviews", "/terms-and-conditions", "/upcoming-masterclasses", "/verify-certificate"];
const PAGES = process.env.ONLY ? process.env.ONLY.split(",") : ALL;
const WIDTHS = [390, 820, 1440];
const name = (p, w) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "__")) + "-" + w + ".png";

async function open(port) {
  const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=" + port, "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=" + process.env.TEMP + "/shoot-" + port, "about:blank"], { stdio: "ignore" });
  await sleep(2500);
  const list = await (await fetch("http://127.0.0.1:" + port + "/json")).json();
  const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
  return { chrome, ws, send, ev };
}

(async () => {
  const mode = process.argv[2];
  if (mode === "shoot") {
    const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
    const { chrome, ws, send, ev } = await open(9345);
    await send("Page.enable"); await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (const p of PAGES) for (const w of WIDTHS) {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
      await send("Page.navigate", { url: "http://localhost:3000" + p }); await sleep(/course|^\/$/.test(p) ? 9500 : 5000);
      await ev("document.documentElement.style.scrollBehavior='auto';var s=document.createElement('style');s.textContent='*,*:before,*:after{animation:none!important;transition:none!important;caret-color:transparent!important}video{visibility:hidden}';document.head.appendChild(s);(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}scrollTo(0,0)})()");
      await sleep(1500);
      const h = Math.min(await ev("document.documentElement.scrollHeight"), 14000);
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
      fs.writeFileSync(path.join(out, name(p, w)), Buffer.from(r.result.data, "base64"));
      process.stdout.write(".");
    }
    console.log(" saved to " + out); ws.close(); chrome.kill();
  } else if (mode === "diff") {
    const [A, B] = [process.argv[3], process.argv[4]];
    const { chrome, ws, send, ev } = await open(9346);
    await send("Page.navigate", { url: "http://localhost:3000/robots.txt" }); await sleep(800);
    await ev(`window.__cmp = async (a, b) => { const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
      const [x, y] = await Promise.all([load(a), load(b)]); const W = Math.max(x.width, y.width), H = Math.max(x.height, y.height);
      const g = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const t = c.getContext('2d'); t.fillStyle = '#f0f'; t.fillRect(0, 0, W, H); t.drawImage(im, 0, 0); return t.getImageData(0, 0, W, H).data; };
      const p = g(x), q = g(y); let bad = 0; const bands = {};
      for (let i = 0; i < p.length; i += 4) { if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 40) { bad++; const row = Math.floor(i / 4 / W); bands[Math.floor(row / 400)] = 1; } }
      return { W: W, H: H, hA: x.height, hB: y.height, pct: +(100 * bad / (W * H)).toFixed(2), bands: Object.keys(bands).map((k) => k * 400).slice(0, 8) }; }; true`);
    const rows = [];
    for (const f of fs.readdirSync(A).filter((x) => x.endsWith(".png"))) {
      if (!fs.existsSync(path.join(B, f))) { rows.push([f, "missing in B"]); continue; }
      const a = fs.readFileSync(path.join(A, f)).toString("base64"), b = fs.readFileSync(path.join(B, f)).toString("base64");
      const r = await ev("window.__cmp(" + JSON.stringify(a) + "," + JSON.stringify(b) + ")");
      rows.push([f, r]);
    }
    rows.sort((x, y) => (y[1].pct || 0) - (x[1].pct || 0));
    rows.forEach(([f, r]) => console.log(f.padEnd(52), typeof r === "string" ? r : r.pct + "% differ" + (r.hA !== r.hB ? "  height " + r.hA + " -> " + r.hB : "") + (r.pct > 0.3 ? "  at y=" + r.bands.join(",") : "")));
    ws.close(); chrome.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
