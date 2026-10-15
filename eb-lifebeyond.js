/* Bhopal course page > Life Beyond Books gallery: the photo strip glides sideways on its own, slowly
   and without stopping, and loops without an end (the columns are repeated once, hidden from screen
   readers, and the strip jumps back by one set when it reaches the copy). There are no arrows: people
   can drag or swipe it left and right with a finger (or scroll it with a trackpad), and the glide
   picks up again a moment after they let go. It also pauses while the mouse is over the gallery or
   something in it has focus, and while the gallery is off screen; with reduced motion it does not
   glide at all. Without this script the strip still scrolls sideways. React can re-render the page
   after load, so new copies of the gallery are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = 28;   // pixels per second
  var IDLE = 2500;  // wait after a touch before gliding again

  function init(lb) {
    var strip = lb.querySelector('.lb-strip');
    if (!strip) return;
    lb.setAttribute('data-lb', '1');
    lb.classList.add('lb-js', 'lb-glide');
    var nav = lb.querySelector('.lb-nav');
    if (nav) nav.style.display = 'none';

    // repeat the columns once so the strip can loop
    var cols = [].slice.call(strip.children), n = cols.length;
    if (n < 2) return;
    cols.forEach(function (c) {
      var copy = c.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('inert', '');
      [].forEach.call(copy.querySelectorAll('a,button'), function (el) { el.tabIndex = -1; });
      [].forEach.call(copy.querySelectorAll('img[loading="lazy"]'), function (im) { im.loading = 'eager'; });
      strip.appendChild(copy);
    });
    [].forEach.call(cols, function (c) {
      [].forEach.call(c.querySelectorAll('img[loading="lazy"]'), function (im) { im.loading = 'eager'; });
    });
    // a continuous glide cannot sit on snap points
    strip.style.scrollSnapType = 'none';
    strip.style.scrollBehavior = 'auto';

    function setWidth() { return strip.children[n].offsetLeft - strip.children[0].offsetLeft; }
    function wrap() {
      var w = setWidth();
      if (w <= 0) return;
      if (strip.scrollLeft >= w) strip.scrollLeft -= w;
      else if (strip.scrollLeft <= 0 && touching) strip.scrollLeft += w;
    }

    var visible = false, hover = false, touching = false, idleUntil = 0, last = 0, pos = 0, raf = 0;
    function nudge() { idleUntil = Date.now() + IDLE; }
    function frame(ts) {
      raf = 0;
      if (reduce || !visible || hover || touching || document.hidden) { last = 0; return; }
      if (!last) { last = ts; pos = strip.scrollLeft; }
      var dt = Math.min(64, ts - last); last = ts;
      if (Date.now() >= idleUntil) {
        pos += SPEED * dt / 1000;
        var w = setWidth();
        if (w > 0 && pos >= w) pos -= w;
        strip.scrollLeft = pos;
      } else {
        pos = strip.scrollLeft;
      }
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

    strip.addEventListener('scroll', function () { if (touching || Date.now() < idleUntil) wrap(); }, { passive: true });
    strip.addEventListener('touchstart', function () { touching = true; nudge(); }, { passive: true });
    strip.addEventListener('touchend', function () { touching = false; nudge(); play(); }, { passive: true });
    strip.addEventListener('touchcancel', function () { touching = false; nudge(); play(); }, { passive: true });
    strip.addEventListener('wheel', function () { nudge(); }, { passive: true });

    // mouse: drag to move, like a finger
    var drag = null;
    strip.addEventListener('mousedown', function (e) { drag = { x: e.clientX, s: strip.scrollLeft, moved: false }; nudge(); });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      strip.scrollLeft = drag.s - dx; wrap(); nudge();
    });
    window.addEventListener('mouseup', function () { if (drag && drag.moved) strip.__dragged = true; drag = null; nudge(); });
    strip.addEventListener('click', function (e) { if (strip.__dragged) { e.preventDefault(); strip.__dragged = false; } }, true);
    strip.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // only a real mouse pauses on hover; phones fire fake mouse events after a tap
    lb.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
    lb.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = false; nudge(); play(); } });
    lb.addEventListener('focusin', function () { hover = true; });
    lb.addEventListener('focusout', function () { hover = false; play(); });
    document.addEventListener('visibilitychange', play);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) play(); }, { threshold: 0.2 }).observe(strip);
    } else { visible = true; }
    play();
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
