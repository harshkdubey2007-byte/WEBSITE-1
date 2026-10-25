// Builds the "Reviews From Our Google Business Profile" section of /reviews from data/google-reviews.json.
//   node tools/build-google-reviews.js
// The review text in the json is copied word for word from the Google Business Profile; this script only lays it out.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/google-reviews.json"), "utf8"));
const file = path.join(ROOT, "reviews/index.html");
let html = fs.readFileSync(file, "utf8");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const COLORS = ["#194CFF", "#F97316", "#0EA5A4", "#7C3AED", "#DB2777", "#16A34A", "#0A1030", "#CA8A04"];
const STAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#FFC24B" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1L12 2Z"/></svg>';
const G = '<svg viewBox="0 0 48 48" width="%S%" height="%S%" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const gPaths = G.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const g = (n) => `<svg width="${n}" height="${n}" aria-hidden="true"><use href="#gmb-g"/></svg>`;
const starPath = STAR.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const STAR1 = '<svg width="16" height="16" aria-hidden="true"><use href="#gmb-star"/></svg>';
const stars = STAR1.repeat(5);
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><symbol id="gmb-star" viewBox="0 0 24 24"><g fill="#FFC24B">${starPath}</g></symbol><symbol id="gmb-g" viewBox="0 0 48 48">${gPaths}</symbol></svg>`;
const FIRST = 9;
const STEP = 12;

function initial(name) { const m = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim(); return (m[0] || "G").toUpperCase(); }
function body(text) {
  return text.split(/\n\s*\n/).map((p) => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join("");
}
const cards = data.reviews.map((r, i) => `<figure class="gmb-c${i >= FIRST ? " gmb-x" : ""}"><div class="gmb-in"><div class="gmb-top"><span class="gmb-av" aria-hidden="true" style="background:${COLORS[i % COLORS.length]}">${esc(initial(r.name))}</span><div class="gmb-who"><b>${esc(r.name)}</b><span>${esc(r.when)}</span></div><span class="gmb-gi">${g(22)}</span></div><span class="gmb-st" role="img" aria-label="5 out of 5 stars">${stars}</span><blockquote class="gmb-t">${body(r.text)}</blockquote><figcaption class="gmb-ft"><span>${g(14)} Posted on Google</span><em>${esc(r.tag)}</em></figcaption></div></figure>`).join("\n");

const URL = data.profile.url;
const section = `<section class="rv-gmb" id="rv-gmb" aria-labelledby="rv-gmb-h"><style>
.rv-gmb{background:#fff;padding:88px 0 96px}
.rv-gmb .rv-hd{margin-bottom:30px}
.rv-gmb .gmb-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:#EEF3FF;border:.8px solid #DCE6FF;color:#194CFF;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:14px}
.rv-gmb .gmb-sum{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;margin:0 auto 40px;padding:16px 28px;max-width:640px;border:1px solid #E3E8F5;border-radius:18px;background:#F8FAFF}
.rv-gmb .gmb-sum b.n{font-size:44px;line-height:1;font-weight:700;color:#0F172A}
.rv-gmb .gmb-sum .s{display:flex;flex-direction:column;gap:4px}
.rv-gmb .gmb-sum .s span.st{display:flex;gap:3px}
.rv-gmb .gmb-sum .s small{font-size:14px;color:#475569}
.rv-gmb .gmb-sum a{font-size:15px;font-weight:600;color:#194CFF;text-decoration:underline;text-underline-offset:3px}
.rv-gmb .gmb-grid{columns:3;column-gap:20px}
.rv-gmb .gmb-c{break-inside:avoid;margin:0 0 20px;padding:12px;border:1px solid #E3E8F5;border-radius:24px;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.04);transition:box-shadow .25s,transform .25s}
.rv-gmb .gmb-c:hover{box-shadow:0 12px 34px rgba(15,23,42,.09);transform:translateY(-3px)}
.rv-gmb .gmb-in{padding:20px;border:1px solid #E8ECF6;border-radius:16px;background:#F8FAFF}
.rv-gmb .gmb-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}
.rv-gmb .gmb-av{flex:0 0 auto;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px}
.rv-gmb .gmb-who{flex:1;min-width:0}
.rv-gmb .gmb-who b{display:block;font-size:15px;line-height:1.3;font-weight:700;color:#0F172A;word-break:break-word}
.rv-gmb .gmb-who span{font-size:13px;color:#64748B}
.rv-gmb .gmb-gi{flex:0 0 auto;display:flex}
.rv-gmb .gmb-st{display:flex;gap:3px;margin-bottom:12px}
.rv-gmb .gmb-t{margin:0;padding:0;border:0;font-size:15px;line-height:1.7;color:#334155;font-family:inherit}
.rv-gmb .gmb-t p{margin:0 0 10px;font-size:15px;line-height:1.7;color:#334155}.rv-gmb .gmb-t p:last-child{margin-bottom:0}
.rv-gmb .gmb-ft{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid #E3E8F5;font-size:13px;color:#64748B}
.rv-gmb .gmb-ft span{display:inline-flex;align-items:center;gap:6px}
.rv-gmb .gmb-ft em{font-style:normal;font-weight:600;color:#194CFF;text-align:right}
.rv-gmb .gmb-x{display:none}
.rv-gmb .gmb-x.gmb-show{display:block}
.rv-gmb .gmb-act{display:flex;justify-content:center;flex-wrap:wrap;gap:14px;margin-top:14px}
.rv-gmb .gmb-btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;min-height:56px;padding:12px 32px;border-radius:12px;background:#194CFF;border:.8px solid #194CFF;color:#fff!important;font-family:inherit;font-size:18px;font-weight:600;line-height:27px;text-decoration:none;cursor:pointer;transition:all .3s ease}
.rv-gmb .gmb-btn:hover{background:#0032E5;border-color:#0032E5}
.rv-gmb .gmb-btn.gmb-ghost{background:#fff;color:#194CFF!important}
.rv-gmb .gmb-btn.gmb-ghost:hover{background:#EEF3FF;border-color:#194CFF}
.rv-gmb .gmb-btn:after{content:"";position:absolute;left:-25%;top:0;width:40px;height:105%;background:linear-gradient(90deg,rgba(255,255,255,.15) 24%,rgba(255,255,255,0) 26%,rgba(255,255,255,0) 53%,rgba(255,255,255,.15) 54%);transform:skew(-40deg,0);animation:ebCtaShine 2.5s infinite;pointer-events:none}
.rv-gmb .gmb-btn.gmb-ghost:after{background:linear-gradient(90deg,rgba(25,76,255,.12) 24%,rgba(25,76,255,0) 26%,rgba(25,76,255,0) 53%,rgba(25,76,255,.12) 54%)}
.rv-gmb .gmb-btn:focus-visible{outline:2px solid #FFC24B;outline-offset:3px}
.rv-gmb .gmb-note{margin:24px auto 0;max-width:760px;text-align:center;font-size:13.5px;line-height:1.7;color:#64748B}
@media (max-width:1000px){.rv-gmb .gmb-grid{columns:2}}
@media (max-width:680px){.rv-gmb{padding:60px 0 68px}.rv-gmb .gmb-grid{columns:1}.rv-gmb .gmb-sum{padding:16px 18px;gap:12px}.rv-gmb .gmb-btn{width:100%;padding:12px 20px;font-size:17px}.rv-gmb .gmb-in{padding:16px}}
@media (prefers-reduced-motion:reduce){.rv-gmb .gmb-btn:after{animation:none}.rv-gmb .gmb-c{transition:none}}
</style>${sprite}<div class="rv-in"><div class="rv-hd"><span class="gmb-pill">${g(14)} Verified Google reviews</span><h2 id="rv-gmb-h">Reviews From Our Google Business Profile</h2><p>Copied word for word from our Google Business Profile. Open the profile and check any of them against the source.</p></div>
<div class="gmb-sum"><span aria-hidden="true">${g(40)}</span><b class="n">${esc(data.profile.rating)}</b><div class="s"><span class="st" role="img" aria-label="${esc(data.profile.rating)} out of 5 stars">${stars}</span><small>${data.profile.count} reviews on Google (${esc(data.profile.asOf)})</small></div><a href="${URL}" target="_blank" rel="noopener">See them on Google</a></div>
<div class="gmb-grid">
${cards}
</div>
<div class="gmb-act"><button type="button" class="gmb-btn" id="gmb-more" aria-expanded="false" aria-controls="rv-gmb">Show more reviews</button><a class="gmb-btn gmb-ghost" href="${URL}" target="_blank" rel="noopener">Read all ${data.profile.count} reviews on Google</a></div>
<p class="gmb-note">Showing ${data.reviews.length} of our ${data.profile.count} Google reviews: the written ones that could be copied in full. The rest are star-only ratings or longer posts, and you can read them on Google. Google shows how long ago each review was posted, so the dates here are approximate months or years. Learners mention internships and placements in their own words; individual results vary.</p></div>
<script>(function(){var s=document.getElementById("rv-gmb"),b=document.getElementById("gmb-more");if(!s||!b)return;var hid=[].slice.call(s.querySelectorAll(".gmb-x")),STEP=${STEP};function left(){b.textContent="Show more reviews ("+hid.length+" more)"}left();b.addEventListener("click",function(){hid.splice(0,STEP).forEach(function(c){c.classList.add("gmb-show")});b.setAttribute("aria-expanded","true");if(hid.length)left();else b.style.display="none"})})();</script></section>`;

const a = html.indexOf('<section class="rv-gmb"');
const z = html.indexOf('<section class="rv-cta">');
if (a < 0 || z < 0 || z < a) throw new Error("could not find the reviews section to replace");
html = html.slice(0, a) + section + html.slice(z);
html = html.replace(/<script src="\/eb-gmb-reviews\.js[^"]*" defer><\/script>/, "");
fs.writeFileSync(file, html);
console.log("reviews on page:", data.reviews.length, "| shown first:", Math.min(FIRST, data.reviews.length));
