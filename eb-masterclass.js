/* Home > Free Masterclasses. Sessions come from /data/masterclasses.json, which the
   admin panel's "Masterclasses" screen edits. On load this script reads that file (or
   the copy saved inside the section if it can't) and builds:
     - the "live meeting" grid: upcoming sessions that have a photo, up to four
     - the countdown to the next session
     - a ticket for every upcoming session, with arrows and a progress line
   Sessions disappear by themselves once they end. Without this script the section
   shows the copy that was built into the page. React can re-render the home page after
   load, so new copies of the section are set up too.
   The templates below are also used by the build script, so the built copy and the
   live version always match. */
(function () {
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var GRID_MAX = 4;
  var PHOTO_FALLBACK = '/images/home-images/masterclass-01.webp';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeUrl(u, fallback) {
    u = String(u || '').trim();
    return /^(\/(?!\/)|https:\/\/)/.test(u) ? u : fallback;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // times in the data file are India time (IST, +05:30)
  function startOf(s) { return Date.parse(s.date + 'T' + (s.time || '00:00') + ':00+05:30'); }
  function endOf(s) { return startOf(s) + (+s.duration || 60) * 60000; }
  function clock(t) {
    var p = String(t || '00:00').split(':'), h = +p[0], m = p[1] || '00';
    return (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function length(min) {
    min = +min || 60;
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m ? m + 'm' : '');
  }
  function parts(s) {
    var d = s.date.split('-');
    return { day: +d[2], mon: MON[+d[1] - 1], wd: DAY[new Date(Date.UTC(+d[0], +d[1] - 1, +d[2])).getUTCDay()], time: clock(s.time) };
  }

  /* Sessions that haven't ended yet, soonest first. */
  function upcoming(list, now) {
    return (list || []).filter(function (s) {
      return s && s.title && /^\d{4}-\d{2}-\d{2}$/.test(s.date || '') && !isNaN(startOf(s)) && endOf(s) > now;
    }).sort(function (a, b) { return startOf(a) - startOf(b); });
  }

  var ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';

  function tile(s, first) {
    var p = parts(s);
    return '<a class="mx-tile' + (first ? ' is-first' : '') + '" href="' + esc(safeUrl(s.link, '/events')) + '">' +
      '<img src="' + esc(safeUrl(s.image, PHOTO_FALLBACK)) + '" alt="" loading="lazy">' +
      '<span class="mx-when">' + p.day + ' ' + p.mon + ' &middot; ' + p.time + '</span>' +
      '<span class="mx-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="mx-cap"><small>' + esc(s.type || 'Live Masterclass') + '</small><b>' + esc(s.title) + '</b></span></a>';
  }
  function soonTile() {
    return '<a class="mx-tile is-soon" href="/events"><img src="' + PHOTO_FALLBACK + '" alt="" loading="lazy">' +
      '<span class="mx-when">Coming soon</span><span class="mx-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="mx-cap"><small>Free Masterclass</small><b>More live sessions are on the way</b></span></a>';
  }
  function ticket(s) {
    var p = parts(s);
    var w = /workshop/i.test(s.type || '');
    return '<a class="mx-tk" href="' + esc(safeUrl(s.link, '/events')) + '">' +
      '<span class="mx-stub"><small>' + p.mon + '</small><b>' + p.day + '</b><em>' + p.wd + '</em><span>' + p.time + '</span></span>' +
      '<span class="mx-body"><span class="mx-type' + (w ? ' w' : '') + '">' + esc(s.type || 'Live Masterclass') + '</span>' +
      '<span class="mx-tt">' + esc(s.title) + '</span>' +
      '<span class="mx-meta">' + length(s.duration) + (s.mentor ? ' &middot; ' + esc(s.mentor) : '') + '</span>' +
      '<span class="mx-foot"><span class="mx-stamp">FREE</span><span class="mx-go">Register ' + ARROW + '</span></span></span></a>';
  }

  /* Everything the section shows for a list of sessions at time `now`. */
  function view(list, now) {
    var up = upcoming(list, now);
    var withPhoto = up.filter(function (s) { return s.image; }).slice(0, GRID_MAX);
    var tiles = withPhoto.length ? withPhoto.map(function (s) { return tile(s, s === up[0]); }).join('') : soonTile();
    return {
      count: up.length,
      next: up[0] || null,
      tilesN: withPhoto.length || 1,
      tiles: tiles,
      tickets: up.map(ticket).join('')
    };
  }

  var api = { view: view, upcoming: upcoming, startOf: startOf, endOf: endOf };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ------------------------------ in the browser ------------------------------ */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DATA_URL = '/data/masterclasses.json';
  var dataP = null;
  function load() {
    if (!dataP) {
      dataP = fetch(DATA_URL, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { if (!d || !Array.isArray(d.sessions)) throw new Error('bad data'); return d.sessions; })
        .catch(function () { dataP = null; return null; });
    }
    return dataP;
  }
  function embedded(sec) {
    try { return JSON.parse(sec.querySelector('.mx-data').textContent).sessions; } catch (e) { return []; }
  }

  function init(sec) {
    sec.setAttribute('data-mx', '1');
    load().then(function (list) { render(sec, list || embedded(sec)); });
  }

  function render(sec, list) {
    var v = view(list, Date.now());
    var grid = sec.querySelector('.mx-grid');
    var track = sec.querySelector('.mx-track');
    if (grid) { grid.innerHTML = v.tiles; grid.setAttribute('data-n', v.tilesN); }
    if (track) track.innerHTML = v.tickets;

    var count = sec.querySelector('.mx-bar-t');
    if (count) count.innerHTML = v.count ? '<b class="mx-n">' + v.count + '</b> ' + (v.count === 1 ? 'session' : 'sessions') : 'More soon';
    sec.classList.toggle('is-empty', !v.count);
    var firstTicket = track && track.querySelector('.mx-tk');
    if (firstTicket) firstTicket.classList.add('is-next');

    countdown(sec, v.next);
    spotlight(sec);
    ticketRow(sec);
    sec.classList.add('is-ready');
  }

  function countdown(sec, s) {
    var box = sec.querySelector('.mx-next');
    if (!box) return;
    if (!s) { box.hidden = true; return; }
    box.hidden = false;
    var start = startOf(s), end = endOf(s);
    var title = box.querySelector('.mx-next-t');
    if (title) title.textContent = s.title;
    var cells = {
      d: box.querySelector('[data-u="d"]'), h: box.querySelector('[data-u="h"]'),
      m: box.querySelector('[data-u="m"]'), s: box.querySelector('[data-u="s"]')
    };
    (function tick() {
      if (!box.isConnected) return;
      var t = Date.now();
      if (t >= end) { box.classList.remove('is-live'); box.hidden = true; return; }
      if (t >= start) { box.classList.add('is-live'); setTimeout(tick, 30000); return; }
      var left = Math.floor((start - t) / 1000);
      cells.d.textContent = pad(Math.floor(left / 86400));
      cells.h.textContent = pad(Math.floor(left % 86400 / 3600));
      cells.m.textContent = pad(Math.floor(left % 3600 / 60));
      cells.s.textContent = pad(left % 60);
      setTimeout(tick, 1000 - t % 1000);
    })();
  }

  // the yellow "speaking" highlight moves from tile to tile
  function spotlight(sec) {
    var tiles = [].slice.call(sec.querySelectorAll('.mx-tile'));
    if (!tiles.length) return;
    var spot = 0;
    function light() { tiles.forEach(function (t, k) { t.classList.toggle('is-spot', k === spot); }); }
    light();
    if (reduce || tiles.length < 2) return;
    var timer = setInterval(function () {
      if (!sec.isConnected) return clearInterval(timer);
      if (document.hidden) return;
      var r = sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      spot = (spot + 1) % tiles.length;
      light();
    }, 2600);
  }

  // ticket row: arrows and progress line
  function ticketRow(sec) {
    var track = sec.querySelector('.mx-track');
    if (!track) return;
    var bar = sec.querySelector('.mx-prog i');
    var prev = sec.querySelector('.mx-prev'), next = sec.querySelector('.mx-next-btn');
    function step() {
      var c = track.querySelector('.mx-tk');
      return c ? c.offsetWidth + 16 : 300;
    }
    function sync() {
      var max = track.scrollWidth - track.clientWidth;
      sec.classList.toggle('mx-scrolls', max > 2);
      if (bar && track.scrollWidth) {
        var w = track.clientWidth / track.scrollWidth;
        bar.style.width = (w * 100) + '%';
        bar.style.transform = 'translateX(' + (max > 0 ? (track.scrollLeft / max) * (1 / w - 1) * 100 : 0) + '%)';
      }
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft > max - 4;
    }
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    if (prev) prev.onclick = function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); };
    if (next) next.onclick = function () { track.scrollBy({ left: step(), behavior: 'smooth' }); };
    sync();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.mx:not([data-mx])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
