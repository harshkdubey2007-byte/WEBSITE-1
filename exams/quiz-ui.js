/* The quiz screens shared by exam papers and practice quizzes: one question at
   a time, a confirmation before submitting, a score summary, and solutions. */
export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LETTER = "ABCD";

/* Inside the learner dashboard (?embed=1): hide this page's header, open links in the full window,
   and keep exam and practice links inside the dashboard. */
/* Opened directly (not inside the dashboard), the page moves into the dashboard: page = "exams" or "practice". */
export function embedMode(page) {
  if (!new URLSearchParams(location.search).has("embed")) {
    if (window.top === window && page) {
      const m = /^#(paper|quiz)=(.+)$/.exec(location.hash);
      location.replace("/dashboard#" + page + (m ? "?" + m[1] + "=" + m[2] : ""));
      return null;
    }
    return false;
  }
  document.body.classList.add("embed");
  document.head.insertAdjacentHTML("beforeend", '<base target="_top">');
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
    const h = a.getAttribute("href"), to = /^\/practice-quizzes\/?(#.*)?$/.test(h) ? "/dashboard#practice" : /^\/exams\/?$/.test(h) ? "/dashboard#exams" : "";
    if (to) { e.preventDefault(); top.location.href = to; }
  }, true);
  return true;
}
export function dialog(html, cls) {
  const ov = document.createElement("div");
  ov.className = "ov";
  ov.innerHTML = '<div class="dlg ' + (cls || "") + '" role="dialog" aria-modal="true">' + html + "</div>";
  document.body.appendChild(ov);
  const onKey = e => { if (e.key === "Escape") close(); };
  const close = () => { ov.remove(); document.removeEventListener("keydown", onKey); };
  document.addEventListener("keydown", onKey);
  return { el: ov, close };
}

/* Runs a quiz inside host. Answers are { questionKey: optionIndex }. */
export function quizRunner(host, o) {
  let i = o.start || 0;
  const qs = o.questions, key = n => qs[n].id || String(n);
  function draw() {
    const q = qs[i], chosen = o.answers[key(i)];
    host.innerHTML = '<div class="qz' + (o.fullPage ? " qz-page" : "") + '"><div class="qz-count">Question ' + (i + 1) + "/" + qs.length + '</div><div class="qz-body"><div class="qz-col">' +
      "<h2>Question " + (i + 1) + '</h2><p class="qz-text">' + esc(q.q) + '</p><div class="qz-opts" role="radiogroup" aria-label="Answer options">' +
      q.options.map((t, k) => '<button type="button" class="qz-opt" role="radio" aria-checked="' + (chosen === k) + '" data-k="' + k + '"><span class="qz-l">' + LETTER[k] + "</span><span>" + esc(t) + "</span></button>").join("") +
      '</div><div class="qz-nav"><button type="button" class="qz-go" data-to="-1"' + (i === 0 ? " disabled" : "") + '><i aria-hidden="true">←</i>Previous</button><button type="button" class="qz-go" data-to="1"' + (i === qs.length - 1 ? " disabled" : "") + '>Next<i aria-hidden="true">→</i></button></div>' +
      '<div class="qz-dots" aria-label="Jump to a question">' + qs.map((_, n) => '<button type="button" data-q="' + n + '" class="' + (o.answers[key(n)] !== undefined ? "done " : "") + (n === i ? "now" : "") + '"' + (n === i ? ' aria-current="true"' : "") + ">" + (n + 1) + "</button>").join("") + "</div>" +
      '</div></div><div class="qz-foot"><span>' + answeredCount() + " of " + qs.length + ' answered</span><button type="button" class="btn primary" data-submit>' + esc(o.submitLabel || "Submit Quiz") + "</button></div></div>";
    host.querySelector("[data-submit]").onclick = () => o.onSubmit();
    host.querySelectorAll(".qz-opt").forEach(b => b.onclick = () => {
      const k = +b.dataset.k, id = key(i);
      /* Clicking the chosen option again clears it. */
      if (o.answers[id] === k) { delete o.answers[id]; if (o.onChoose) o.onChoose(id, null); }
      else { o.answers[id] = k; if (o.onChoose) o.onChoose(id, k); }
      draw();
    });
    host.querySelectorAll("[data-to]").forEach(b => b.onclick = () => go(i + +b.dataset.to));
    host.querySelectorAll("[data-q]").forEach(b => b.onclick = () => go(+b.dataset.q));
  }
  function answeredCount() { return qs.filter((_, n) => o.answers[key(n)] !== undefined).length; }
  function go(n) { if (n >= 0 && n < qs.length) { i = n; draw(); const b = host.querySelector(".qz-body"); if (b) b.scrollTop = 0; } }
  draw();
  return { answered: answeredCount, total: qs.length };
}

export function confirmSubmit(extraHtml, onYes) {
  const d = dialog("<h2>Are you sure?</h2><p>Are you sure you want to submit this? This process cannot be undone.</p>" + (extraHtml || "") +
    '<div class="err" role="alert" hidden></div><div class="acts"><button class="btn" data-x>Cancel</button><button class="btn primary" data-go>Yes, I\'m sure</button></div>', "center");
  d.el.querySelector("[data-x]").onclick = d.close;
  d.el.querySelector("[data-go]").onclick = async e => {
    e.target.disabled = true;
    try { await onYes(); d.close(); }
    catch (ex) { const err = d.el.querySelector(".err"); err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
  };
}

export function fmtDuration(ms) {
  const t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60, p = n => String(n).padStart(2, "0");
  return h ? h + ":" + p(m) + ":" + p(s) : m + ":" + p(s);
}

/* r: { title, attemptedAt, timeMs, total, correct, wrong, unanswered, grid, rank?, participants?, best? } */
export function quizSummary(host, r, actions) {
  const pct = r.total ? r.correct / r.total * 100 : 0, attempted = r.correct + r.wrong, acc = attempted ? Math.round(r.correct / attempted * 100) : 0;
  const when = new Date(r.attemptedAt).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const a = r.total ? r.correct / r.total * 360 : 0, b = r.total ? (r.correct + r.wrong) / r.total * 360 : 0;
  const lead = r.rank ? { label: "Rank", main: r.rank + "<small> / " + r.participants + "</small>", sub: r.participants + (r.participants === 1 ? " participant" : " participants") }
    : r.best !== undefined ? { label: "Your best score", main: r.best + "<small> / " + r.total + "</small>", sub: "Saved on this device" }
    : { label: "Questions", main: String(r.total), sub: "" };
  host.innerHTML = '<div class="sm"><h1>Quiz Summary</h1><div class="sm-head"><div><b>' + esc(r.title) + "</b><span>Attempted on " + esc(when) + " | Time taken: " + fmtDuration(r.timeMs) + '</span></div><div class="sm-bar">Score: ' + r.correct + "/" + r.total + '<i><s style="width:' + pct + '%"></s></i>' + pct.toFixed(2) + "%</div></div>" +
    '<div class="sm-grid"><div class="sm-card wide full"><label>' + lead.label + "</label><strong>" + lead.main + "</strong>" + (lead.sub ? '<div class="meta" style="margin-top:6px">' + esc(lead.sub) + "</div>" : "") + "</div>" +
    '<div class="sm-card warm"><label>Score</label><div class="sm-split"><strong>' + r.correct + "<small> /" + r.total + " marks</small></strong><strong>" + pct.toFixed(2) + "%</strong></div></div>" +
    '<div class="sm-card pale"><label>Time Taken</label><strong>' + fmtDuration(r.timeMs) + '</strong></div><div class="sm-card pale"><label>Accuracy</label><strong>' + acc + "%</strong></div>" +
    '<div class="sm-card cream"><label>Attempted Questions</label><strong>' + attempted + "<small> /" + r.total + " questions</small></strong></div></div>" +
    '<div class="sm-break"><div class="sm-pie"><div class="sm-donut" role="img" aria-label="' + r.correct + " correct, " + r.wrong + " wrong, " + r.unanswered + ' unanswered" style="background:conic-gradient(#4FBF7B 0 ' + a + "deg,#E8607A " + a + "deg " + b + "deg,#D5DBEA " + b + 'deg 360deg)"></div><ul class="sm-legend">' +
    '<li><span class="sm-sw correct">✓</span>Correct answer<b>' + r.correct + '</b></li><li><span class="sm-sw wrong">×</span>Wrong answer<b>' + r.wrong + '</b></li><li><span class="sm-sw none">–</span>Unanswered<b>' + r.unanswered + "</b></li></ul></div>" +
    '<div class="sm-sel"><h3>Your Selection</h3><div class="sm-cells">' + r.grid.map((g, n) => '<span class="' + g + '" title="Question ' + (n + 1) + ": " + ({ correct: "correct", wrong: "wrong", none: "unanswered" })[g] + '">' + (n + 1) + "</span>").join("") + "</div></div></div>" +
    '<div class="acts">' + actions.map((x, n) => '<button class="btn' + (x.primary ? " primary" : "") + '" data-a="' + n + '">' + esc(x.label) + "</button>").join("") + "</div></div>";
  host.querySelectorAll("[data-a]").forEach(b => b.onclick = actions[+b.dataset.a].run);
  scrollTo(0, 0);
}

/* items: [{ q, options, answer, chosen, explain }] */
export function quizSolutions(host, title, items, onBack) {
  host.innerHTML = '<div class="sol"><h1 style="font-size:20px">Solutions</h1><div class="meta">' + esc(title) + "</div>" + items.map((x, n) =>
    '<article class="sol-q"><h3>Question ' + (n + 1) + "</h3><p>" + esc(x.q) + "</p>" + x.options.map((t, k) => {
      const right = k === x.answer, mine = k === x.chosen;
      return '<div class="sol-o' + (right ? " right" : mine ? " miss" : "") + '"><span class="qz-l">' + LETTER[k] + "</span><span>" + esc(t) + "</span>" + (right ? "<em>Correct answer" + (mine ? " · Your answer" : "") + "</em>" : mine ? "<em>Your answer</em>" : "") + "</div>";
    }).join("") + (x.chosen === null || x.chosen === undefined ? '<div class="meta" style="margin-top:8px">You did not answer this question.</div>' : "") + (x.explain ? '<div class="sol-x">' + esc(x.explain) + "</div>" : "") + "</article>").join("") +
    '<div class="acts" style="justify-content:center;margin-top:22px"><button class="btn primary" data-b>Back to summary</button></div></div>';
  host.querySelector("[data-b]").onclick = onBack;
  scrollTo(0, 0);
}
