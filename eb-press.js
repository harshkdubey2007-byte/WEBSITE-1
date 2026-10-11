/* About > Media Presence ("As featured in"). The outlets come from /data/press.json, which
   the admin panel's "Press mentions" screen edits. On load this script reads that file (or
   the copy saved inside the section if it can't) and draws a logo grid like the "Brands
   We've Worked With" section: one tile per outlet (its logo, or a blank placeholder until a
   logo is added), linking to the story when a link is set. Blank tiles fill the first rows
   until enough outlets are added; past twelve, the rest sit behind a "Show all" button.
   It also fills the BREAKING ticker with the outlet names. React can re-render the page
   after load, so new copies of the section are set up too. The templates are also used by
   the build script. */
(function () {
  var SHOWN = 12;
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safe(u, rx) { u = String(u || '').trim(); return rx.test(u) ? u : ''; }
  var BLANK = '<span class="pt-blank" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg></span>';

  function tile(it) {
    if (!it) return '<li><span class="pt is-empty">' + BLANK + '</span></li>';
    var url = safe(it.url, /^https?:\/\//);
    var logo = safe(it.logo, /^(\/(?!\/)|https:\/\/)/);
    var face = logo ? '<img src="' + esc(logo) + '" alt="' + esc(it.name) + '" loading="lazy">' : BLANK + '<span class="pr-sr">' + esc(it.name) + '</span>';
    return url
      ? '<li><a class="pt" href="' + esc(url) + '" target="_blank" rel="noopener">' + face + '<span class="pr-sr"> (opens the story in a new tab)</span></a></li>'
      : '<li><span class="pt' + (logo ? '' : ' is-empty') + '">' + face + '</span></li>';
  }

  /* The visible tiles, the ones behind "Show all", and the ticker text. */
  function view(data) {
    var items = (data && data.items || []).filter(function (it) { return it && it.name; });
    var total = String(data && data.total || items.length);
    var n = parseInt(total, 10);
    var more = n > items.length ? n - items.length : 0;
    var first = items.slice(0, SHOWN);
    while (first.length < SHOWN) first.push(null);       // blank tiles until enough outlets are added
    var names = items.map(function (it) { return esc(it.name); });
    if (more) names.push('and ' + more + ' more');
    var tick = names.map(function (t) { return '<span>' + t + '</span>'; }).join('');
    return {
      total: total,
      tiles: first.map(tile).join(''),
      rest: items.slice(SHOWN).map(tile).join(''),
      restCount: Math.max(0, items.length - SHOWN),
      all: items.length,
      ticker: tick + tick // twice, so the scroll loops seamlessly
    };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { view: view, SHOWN: SHOWN }; return; }

  /* ------------------------------ in the browser ------------------------------ */
  var dataP = null;
  function load() {
    if (!dataP) {
      dataP = fetch('/data/press.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { if (!d || !Array.isArray(d.items)) throw new Error('bad data'); return d; })
        .catch(function () { dataP = null; return null; });
    }
    return dataP;
  }
  function init(sec) {
    sec.setAttribute('data-pr', '1');
    load().then(function (d) {
      if (!d) { try { d = JSON.parse(sec.querySelector('.pr-data').textContent); } catch (e) { return; } }
      var v = view(d);
      var grid = sec.querySelector('.pt-grid');
      if (grid) grid.innerHTML = v.tiles;
      var more = sec.querySelector('.pt-more');
      if (more) {
        more.hidden = !v.restCount;
        var restGrid = more.querySelector('.pt-grid'), label = more.querySelector('.pt-all');
        if (restGrid) restGrid.innerHTML = v.rest;
        if (label) label.textContent = 'Show all ' + v.all + ' news websites';
      }
      var tk = sec.querySelector('.pr-run');
      if (tk) tk.innerHTML = v.ticker;
      [].forEach.call(sec.querySelectorAll('.pr-total'), function (el) { el.textContent = v.total; });
    });
  }
  function run() {
    [].forEach.call(document.querySelectorAll('.pr:not([data-pr])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
