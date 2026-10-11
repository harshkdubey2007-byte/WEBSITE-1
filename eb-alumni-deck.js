/* Home > Our Trusted Alumni: turns the card row into a fanned, swipeable deck.
   Swipe (or drag) the top card left/right, use the arrow buttons, the keyboard, or tap a
   face below to jump to that person. Autoplays while the section is on screen and pauses
   while the visitor is interacting. Without this script the cards stay a plain swipe row.
   React can re-render the home page after load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP = 3600;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function init(sec) {
    var deck = sec.querySelector('.alx-deck');
    var cards = deck ? [].slice.call(deck.querySelectorAll('.alx-card')) : [];
    var n = cards.length;
    if (n < 2) return;
    sec.setAttribute('data-alx', '1');

    var faces = [].slice.call(sec.querySelectorAll('.alx-face'));
    var strip = sec.querySelector('.alx-faces');
    var cur = sec.querySelector('.alx-cur');
    var bar = sec.querySelector('.alx-bar');
    var i = 0, visible = false, holdUntil = 0, timer = null;

    deck.classList.add('alx-js');
    sec.classList.add('is-ready');

    function place(c, d) {
      var side = d % 2 ? -1 : 1;
      var t = d === 0 ? 'none'
        : 'translate(' + side * d * 7 + 'px,' + d * 15 + 'px) scale(' + (1 - d * 0.06) + ') rotate(' + side * (2.5 + d * 1.6) + 'deg)';
      c.style.transform = t;
    }

    function layout() {
      cards.forEach(function (c, k) {
        var d = (k - i + n) % n;
        c.style.zIndex = n - d;
        c.style.opacity = d > 3 ? 0 : 1;
        c.classList.toggle('is-top', d === 0);
        c.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
        place(c, Math.min(d, 4));
      });
      faces.forEach(function (f, k) {
        var on = k === i;
        f.classList.toggle('is-on', on);
        f.setAttribute('aria-current', on ? 'true' : 'false');
        if (on && strip && strip.scrollWidth > strip.clientWidth) {
          strip.scrollTo({ left: f.offsetLeft - strip.clientWidth / 2 + f.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
        }
      });
      if (cur) cur.textContent = pad(i + 1);
      runBar();
    }

    // the thin progress line under the counter fills up while autoplay waits
    function runBar() {
      if (!bar) return;
      bar.classList.remove('is-run');
      void bar.offsetWidth;
      if (!reduce && visible && Date.now() >= holdUntil) bar.classList.add('is-run');
    }

    function go(k) { i = (k + n) % n; layout(); schedule(); }

    function hold(ms) { holdUntil = Date.now() + ms; runBar(); schedule(); }

    function schedule() {
      clearTimeout(timer);
      if (reduce) return;
      var h = holdUntil - Date.now();
      if (h > 0) {
        timer = setTimeout(function () { runBar(); schedule(); }, h);
        return;
      }
      timer = setTimeout(function () {
        if (visible && !document.hidden) go(i + 1);
        else schedule();
      }, STEP);
    }

    function fly(dir) {
      var top = cards[i];
      top.style.transition = 'transform .35s ease, opacity .35s ease';
      top.style.transform = 'translate(' + dir * 130 + '%, -6%) rotate(' + dir * 22 + 'deg)';
      top.style.opacity = 0;
      setTimeout(function () { top.style.transition = ''; go(dir < 0 ? i + 1 : i - 1); }, 260);
    }

    // drag / swipe on the top card
    var down = false, sx = 0, sy = 0, dx = 0, axis = null;
    deck.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || !e.target.closest('.alx-card.is-top')) return;
      down = true; sx = e.clientX; sy = e.clientY; dx = 0; axis = null;
      hold(8000);
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var mx = e.clientX - sx, my = e.clientY - sy;
      if (!axis && (Math.abs(mx) > 6 || Math.abs(my) > 6)) axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (axis !== 'x') return;
      dx = mx;
      var top = cards[i];
      top.style.transition = 'none';
      top.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 16 + 'deg)';
      deck.classList.add('is-drag');
    });
    function end() {
      if (!down) return;
      down = false;
      deck.classList.remove('is-drag');
      var top = cards[i];
      top.style.transition = '';
      if (axis === 'x' && Math.abs(dx) > 70) fly(dx < 0 ? -1 : 1);
      else place(top, 0);
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    var prev = sec.querySelector('.alx-prev'), next = sec.querySelector('.alx-next');
    if (prev) prev.addEventListener('click', function () { hold(8000); fly(1); });
    if (next) next.addEventListener('click', function () { hold(8000); fly(-1); });
    faces.forEach(function (f, k) { f.addEventListener('click', function () { hold(8000); go(k); }); });
    deck.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); hold(8000); fly(1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); hold(8000); fly(-1); }
    });
    var stage = sec.querySelector('.alx-stage') || deck;
    stage.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hold(60000); });
    stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hold(0); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        runBar();
        schedule();
      }, { threshold: 0.35 }).observe(deck);
    } else {
      visible = true;
    }

    layout();
    schedule();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.alx:not([data-alx])'), init);
  }

  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
