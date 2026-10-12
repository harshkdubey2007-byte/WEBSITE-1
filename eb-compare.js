/* Bhopal course page > What Makes eBuddha Digitech Different?: on phones the comparison is a
   swipe row of "VS" cards; this adds the prev / next buttons, the progress bar and the
   "3 / 11" counter under it, kept in step with swiping. On desktop it is a table and this
   script has nothing to do. React can re-render the page after load, so new copies of the
   section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(sec) {
    var row = sec.querySelector('.cx-list');
    var cards = row ? [].slice.call(row.children) : [];
    var prev = sec.querySelector('.cx-prev'), next = sec.querySelector('.cx-next');
    var bar = sec.querySelector('.cx-bar i'), cnt = sec.querySelector('.cx-cnt');
    if (!cards.length || !prev || !next) return;
    sec.setAttribute('data-cx', '1');
    sec.classList.add('cx-js');
    var n = cards.length, cur = -1;

    function index() {
      var best = 0, bd = Infinity, x = row.scrollLeft;
      cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft - row.offsetLeft - 16 - x); if (d < bd) { bd = d; best = i; } });
      // at the very end of the row the last card may not reach the left edge
      if (row.scrollLeft + row.clientWidth >= row.scrollWidth - 2) best = n - 1;
      return best;
    }
    function paint() {
      var k = index();
      if (k === cur) return;
      cur = k;
      bar.style.width = ((k + 1) / n * 100) + '%';
      cnt.textContent = (k + 1) + ' / ' + n;
      prev.disabled = k === 0;
      next.disabled = k === n - 1;
    }
    function go(k) {
      k = Math.max(0, Math.min(n - 1, k));
      row.scrollTo({ left: cards[k].offsetLeft - row.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
    }
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    var raf = 0;
    row.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; paint(); }); }, { passive: true });
    window.addEventListener('resize', function () { cur = -1; paint(); });
    paint();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.cx:not([data-cx])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
