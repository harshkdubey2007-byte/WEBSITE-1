/* About > What We Teach, What We Deliver: on tablet and phone the two lists are the two
   faces of one card that flips in 3D (switch above it, the flip button, or a sideways
   swipe). It tilts once when it first scrolls into view, to show that it turns. On
   desktop both faces sit side by side and this script only keeps the switch in sync.
   Without it, both lists are shown one after the other. React can re-render the page
   after load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq = window.matchMedia ? window.matchMedia('(max-width: 991px)') : { matches: false };

  function init(sec) {
    var card = sec.querySelector('.tw-card');
    var faces = sec.querySelectorAll('.tw-face');
    var opts = sec.querySelectorAll('.tw-opt');
    if (!card || faces.length !== 2) return;
    sec.setAttribute('data-tw', '1');
    sec.classList.add('tw-js');
    var side = 0;

    function paint() {
      sec.classList.toggle('is-back', side === 1);
      [].forEach.call(opts, function (o, k) { o.setAttribute('aria-pressed', k === side ? 'true' : 'false'); });
      [].forEach.call(faces, function (f, k) {
        var hidden = mq.matches && k !== side;
        f.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        if (hidden) f.setAttribute('inert', ''); else f.removeAttribute('inert');
      });
    }
    function flip(to) { side = to == null ? 1 - side : to; paint(); }

    [].forEach.call(opts, function (o, k) { o.addEventListener('click', function () { flip(k); }); });
    [].forEach.call(sec.querySelectorAll('.tw-turn'), function (b) { b.addEventListener('click', function () { flip(); }); });

    // sideways swipe on the card
    var sx = 0, sy = 0, on = false;
    card.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
    card.addEventListener('touchend', function (e) {
      if (!on || !mq.matches) return;
      on = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) flip(dx < 0 ? 1 : 0);
    }, { passive: true });

    // one-time tilt hint when it first scrolls into view
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        if (mq.matches && side === 0) {
          card.classList.add('tw-hint');
          setTimeout(function () { card.classList.remove('tw-hint'); }, 1400);
        }
      }, { threshold: 0.45 });
      io.observe(card);
    }

    if (mq.addEventListener) mq.addEventListener('change', paint);
    paint();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.tw:not([data-tw])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
