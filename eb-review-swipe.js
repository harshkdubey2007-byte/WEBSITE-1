/* Home > Student Reviews: the auto-scrolling row can also be swiped with a finger (or dragged / wheeled on desktop).
   The CSS marquee is replaced by a scrollLeft-driven autoplay that pauses while the visitor interacts. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function run() {
    var vp = document.querySelector('.eb-rv-vp');
    var track = vp && vp.querySelector('.eb-rv-track');
    if (!track || vp.classList.contains('eb-rv-sw')) return;
    var cards = track.children;
    if (cards.length < 2 || cards.length % 2) return;

    var css = document.createElement('style');
    css.textContent = '.eb-rv-vp.eb-rv-sw{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;cursor:grab}' +
      '.eb-rv-vp.eb-rv-sw::-webkit-scrollbar{display:none}' +
      '.eb-rv-vp.eb-rv-sw.drag{cursor:grabbing;user-select:none}' +
      '.eb-rv-vp.eb-rv-sw .eb-rv-track{animation:none!important;transform:none!important}';
    document.head.appendChild(css);
    vp.classList.add('eb-rv-sw');

    function loopPoint() { return cards[cards.length / 2].offsetLeft - cards[0].offsetLeft; }
    var LEFT = 200;               // keep the position inside [LEFT, LEFT + loopPoint] so both directions have room
    var pos = LEFT, paused = false, visible = true, resumeAt = 0, hover = false, last = 0;
    var SPEED = 36;               // px per second, same pace as the old 60s marquee
    vp.scrollLeft = pos;

    function wrap() {
      var lp = loopPoint();
      if (vp.scrollLeft >= LEFT + lp) { vp.scrollLeft -= lp; pos = vp.scrollLeft; }
      else if (vp.scrollLeft < LEFT - 100) { vp.scrollLeft += lp; pos = vp.scrollLeft; }
    }

    function hold(ms) { paused = true; resumeAt = Date.now() + ms; }
    ['touchstart', 'pointerdown', 'wheel'].forEach(function (ev) {
      vp.addEventListener(ev, function () { hold(3500); }, { passive: true });
    });
    vp.addEventListener('touchend', function () { hold(2500); }, { passive: true });
    vp.addEventListener('scroll', function () { if (paused) { pos = vp.scrollLeft; wrap(); } }, { passive: true });

    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      vp.addEventListener('mouseenter', function () { hover = true; });
      vp.addEventListener('mouseleave', function () { hover = false; });
      // mouse drag
      var down = false, sx = 0, sl = 0;
      vp.addEventListener('mousedown', function (e) { down = true; sx = e.clientX; sl = vp.scrollLeft; vp.classList.add('drag'); hold(3500); });
      window.addEventListener('mousemove', function (e) { if (down) { vp.scrollLeft = sl - (e.clientX - sx); wrap(); } });
      window.addEventListener('mouseup', function () { if (down) { down = false; vp.classList.remove('drag'); hold(2500); } });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(vp);
    }

    function tick(t) {
      var dt = last ? Math.min(t - last, 100) : 16;
      last = t;
      if (paused && Date.now() >= resumeAt) { paused = false; pos = vp.scrollLeft; }
      if (!reduce && !paused && !hover && visible && !document.hidden) {
        pos += SPEED * dt / 1000;
        vp.scrollLeft = pos;
        wrap();
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
