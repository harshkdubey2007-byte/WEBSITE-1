/* About > Industries We Serve: the six industries orbit the eBuddha logo. Picking one (tap
   its icon, the list, the arrows, a swipe on the card, or autoplay) turns the dial so that
   industry swings round to face its details: downwards on phones (the card is below the
   dial), to the right on desktop (the list is beside it). Without this script every
   industry is listed with its description. React can re-render the page after load, so
   new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq = window.matchMedia ? window.matchMedia('(max-width: 991px)') : { matches: false };
  var STEP = 4200;

  function init(sec) {
    var ring = sec.querySelector('.ind-ring');
    var nodes = [].slice.call(sec.querySelectorAll('.ind-node'));
    var items = [].slice.call(sec.querySelectorAll('.ind-item'));
    var n = nodes.length;
    if (!ring || n < 2 || items.length !== n) return;
    sec.setAttribute('data-ind', '1');
    sec.classList.add('ind-js');
    var cur = sec.querySelector('.ind-count b');
    var i = 0, rot = 0, visible = false, holdUntil = 0, timer = null;

    function select(k, user) {
      i = (k + n) % n;
      var face = mq.matches ? 180 : 90;           // where the chosen industry should end up
      var target = face - i * (360 / n);
      var delta = ((target - rot) % 360 + 540) % 360 - 180; // shortest way round
      rot += delta;
      ring.style.setProperty('--rot', rot + 'deg');
      nodes.forEach(function (b, j) { b.classList.toggle('is-on', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      items.forEach(function (it, j) { it.classList.toggle('is-on', j === i); });
      if (cur) cur.textContent = (i < 9 ? '0' : '') + (i + 1);
      if (user) holdUntil = Date.now() + 10000;
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (reduce) return;
      timer = setTimeout(function () {
        if (!sec.isConnected) return;
        if (visible && !document.hidden && Date.now() >= holdUntil) select(i + 1);
        else schedule();
      }, Math.max(STEP, holdUntil - Date.now()));
    }

    nodes.forEach(function (b, k) { b.addEventListener('click', function () { select(k, true); }); });
    items.forEach(function (it, k) {
      var q = it.querySelector('.ind-q');
      if (q) q.addEventListener('click', function () { select(k, true); });
    });
    var prev = sec.querySelector('.ind-prev'), next = sec.querySelector('.ind-next');
    if (prev) prev.addEventListener('click', function () { select(i - 1, true); });
    if (next) next.addEventListener('click', function () { select(i + 1, true); });

    // swipe the card on phones
    var side = sec.querySelector('.ind-side'), sx = 0, sy = 0;
    if (side) {
      side.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      side.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) select(dx < 0 ? i + 1 : i - 1, true);
      }, { passive: true });
    }
    sec.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') holdUntil = Date.now() + 60000; });
    sec.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { holdUntil = 0; schedule(); } });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.3 }).observe(ring);
    } else {
      visible = true;
    }
    if (mq.addEventListener) mq.addEventListener('change', function () { select(i); });

    // place the first industry without the turning animation
    sec.classList.add('ind-still');
    select(0);
    void ring.offsetWidth;
    sec.classList.remove('ind-still');
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.ind:not([data-ind])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
