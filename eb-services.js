/* Home > We Practice What We Teach: each service card's little dashboard (line chart, bars,
   hearts, typing, page load, swatches) plays the first time the card comes into view, and
   the dots under the swipe row on phones follow the scroll. Without this script, or with
   reduced motion, the dashboards are shown finished. React can re-render the page after
   load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (en) {
    en.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.55 }) : null;

  function init(sec) {
    sec.setAttribute('data-sw', '1');
    var cards = [].slice.call(sec.querySelectorAll('.sw-card'));
    if (!reduce && io) {
      sec.classList.add('sw-js');
      cards.forEach(function (c) { io.observe(c); });
    }

    var row = sec.querySelector('.sw-grid'), wrap = sec.querySelector('.sw-dots');
    if (!row || !wrap) return;
    cards.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw-dot';
      b.setAttribute('aria-label', 'Show service ' + (i + 1) + ' of ' + cards.length);
      b.addEventListener('click', function () { row.scrollTo({ left: c.offsetLeft - row.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' }); });
      wrap.appendChild(b);
    });
    function sync() {
      var mid = row.scrollLeft + row.clientWidth / 2, best = 0, bd = Infinity;
      cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft - row.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
      [].forEach.call(wrap.children, function (d, i) { d.setAttribute('aria-current', i === best ? 'true' : 'false'); });
    }
    row.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.sw:not([data-sw])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
