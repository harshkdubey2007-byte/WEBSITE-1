/* About > Our Vision + What Drives Us: reveals each block as it scrolls into view (photo
   opens up, text rises in, ticks draw, the quote gets highlighted). Without this script, or
   with reduced motion, everything is simply shown. React can re-render the page after load,
   so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.22, rootMargin: '0px 0px -8% 0px' });

  function init(sec) {
    sec.setAttribute('data-vp', '1');
    sec.classList.add('vp-js');
    [].forEach.call(sec.querySelectorAll('.vp-blk, .vp-link'), function (b) { io.observe(b); });
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.vp:not([data-vp])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
