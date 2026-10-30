/* Hire From Us > What Employers Say: one row of review cards.
   A finger swipe (or trackpad / mouse drag on desktop) moves it by hand. After the visitor has stayed on the section for 5 seconds it
   starts drifting very slowly; it stops while the visitor touches, hovers or drags it, and picks up again a few seconds later.
   The second half of the cards is a copy of the first, so the row loops without a visible jump. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function run() {
    var sec = document.querySelector('.eb-employer-reviews');
    var wrap = sec && sec.querySelector('.eb-rs-wrap');
    var track = wrap && wrap.querySelector('.eb-rs-track');
    if (!track || wrap.getAttribute('data-eb-scroll')) return;
    var cards = track.children;
    if (cards.length < 2 || cards.length % 2) return;
    wrap.setAttribute('data-eb-scroll', '1');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Employer reviews, swipe or use the arrow keys');

    var SPEED = 22;            // px per second: slow enough to read a card while it moves
    var START_AFTER = 5000;    // ms the section must stay in view before it starts
    var HOLD = 4000;           // ms of rest after the visitor lets go
    var LEFT = 24;             // the position is kept in [LEFT, LEFT + loop) so the visitor can also go backwards
    var pos = 0, held = 0, hover = false, inView = false, armed = false, timer = 0, last = 0, jumped = false;

    function loop() { return cards[cards.length / 2].offsetLeft - cards[0].offsetLeft; }
    function wrapPos() {
      var lp = loop();
      if (!lp) return;
      if (wrap.scrollLeft >= LEFT + lp) { wrap.scrollLeft -= lp; pos = wrap.scrollLeft; }
      else if (jumped && wrap.scrollLeft < LEFT - 8) { wrap.scrollLeft += lp; pos = wrap.scrollLeft; }
    }
    // the first touch / drag / key press moves the view one loop in (it looks the same), so there is room to go backwards
    function enter() {
      if (jumped) return;
      jumped = true;
      var lp = loop();
      if (lp && wrap.scrollLeft < LEFT) { wrap.scrollLeft += lp; pos = wrap.scrollLeft; }
    }
    function hold() { held = Date.now() + HOLD; }
    function touch() { enter(); hold(); }

    ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (ev) { wrap.addEventListener(ev, touch, { passive: true }); });
    wrap.addEventListener('touchend', hold, { passive: true });
    wrap.addEventListener('scroll', function () {
      if (Date.now() < held || !armed) { pos = wrap.scrollLeft; wrapPos(); }
    }, { passive: true });

    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      wrap.addEventListener('mouseenter', function () { hover = true; });
      wrap.addEventListener('mouseleave', function () { hover = false; hold(); });
      var down = false, sx = 0, sl = 0;
      wrap.addEventListener('mousedown', function (e) { if (e.button) return; touch(); down = true; sx = e.clientX; sl = wrap.scrollLeft; wrap.classList.add('drag'); });
      window.addEventListener('mousemove', function (e) { if (down) { wrap.scrollLeft = sl - (e.clientX - sx); wrapPos(); } });
      window.addEventListener('mouseup', function () { if (down) { down = false; wrap.classList.remove('drag'); hold(); } });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        clearTimeout(timer);
        if (inView) { timer = setTimeout(function () { armed = true; pos = wrap.scrollLeft; }, START_AFTER); }
        else { armed = false; }
      }, { threshold: 0.35 }).observe(sec);
    }

    function tick(t) {
      var dt = last ? Math.min(t - last, 100) : 16;
      last = t;
      if (!reduce && armed && inView && !hover && !document.hidden && Date.now() >= held) {
        pos += SPEED * dt / 1000;
        wrap.scrollLeft = pos;
        wrapPos();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function isHydrated() {
    return [].some.call(document.scripts, function (s) { return !s.src && /__next_f\.push/.test(s.textContent || ''); });
  }
  function start() { run(); }

  if (document.readyState === 'complete') {
    setTimeout(start, isHydrated() ? 900 : 0);
  } else if (isHydrated()) {
    window.addEventListener('load', function () { setTimeout(start, 900); });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
