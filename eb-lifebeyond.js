/* Bhopal course page > Life Beyond Books gallery: the photo strip slides by itself one column
   every 3 seconds and loops without an end (the columns are repeated once, hidden from screen
   readers, and the strip jumps back by one set when it reaches the copy). The prev / next arrows
   move one column. Auto-sliding pauses while the mouse is over the gallery or something in it has
   focus, for 5 seconds after a swipe or arrow press, and while the gallery is off screen; it never
   runs with reduced motion. Without this script the strip still scrolls sideways. React can
   re-render the page after load, so new copies of the gallery are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EVERY = 3000, IDLE = 5000;

  function init(lb) {
    var strip = lb.querySelector('.lb-strip'), prev = lb.querySelector('.lb-prev'), next = lb.querySelector('.lb-next');
    if (!strip || !prev || !next) return;
    lb.setAttribute('data-lb', '1');
    lb.classList.add('lb-js');

    // repeat the columns once so the strip can loop
    var cols = [].slice.call(strip.children), n = cols.length;
    cols.forEach(function (c) {
      var copy = c.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('inert', '');
      [].forEach.call(copy.querySelectorAll('a,button'), function (el) { el.tabIndex = -1; });
      strip.appendChild(copy);
    });

    function step() { var c = strip.children; return c[1].offsetLeft - c[0].offsetLeft; }
    function setWidth() { return strip.children[n].offsetLeft - strip.children[0].offsetLeft; }
    function jump(x) { // move without animation (used to wrap around)
      strip.style.scrollBehavior = 'auto';
      strip.style.scrollSnapType = 'none';
      strip.scrollLeft = x;
      void strip.offsetWidth;
      strip.style.scrollSnapType = '';
      strip.style.scrollBehavior = '';
    }
    function wrap() {
      var w = setWidth();
      if (strip.scrollLeft >= w) jump(strip.scrollLeft - w);
    }
    function go(dir) {
      if (dir < 0 && strip.scrollLeft < step() / 2) jump(strip.scrollLeft + setWidth());
      strip.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    }

    var settle = null;
    strip.addEventListener('scroll', function () {
      clearTimeout(settle);
      settle = setTimeout(wrap, 120); // wrap once the scroll has come to rest
    }, { passive: true });

    // auto-slide
    var timer = null, visible = false, hover = false, idleUntil = 0;
    function tick() {
      clearInterval(timer); timer = null;
      if (reduce || !visible || hover || document.hidden) return;
      timer = setInterval(function () {
        if (Date.now() < idleUntil) return;
        go(1);
      }, EVERY);
    }
    function nudge() { idleUntil = Date.now() + IDLE; }

    prev.addEventListener('click', function () { nudge(); go(-1); });
    next.addEventListener('click', function () { nudge(); go(1); });
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (ev) { strip.addEventListener(ev, nudge, { passive: true }); });
    lb.addEventListener('mouseenter', function () { hover = true; tick(); });
    lb.addEventListener('mouseleave', function () { hover = false; tick(); });
    lb.addEventListener('focusin', function () { hover = true; tick(); });
    lb.addEventListener('focusout', function () { hover = false; tick(); });
    document.addEventListener('visibilitychange', tick);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; tick(); }, { threshold: 0.3 }).observe(strip);
    }
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.lb:not([data-lb])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
