/* About > Student Experience Team: the ID badges swing with the swipe (they lean the way
   you scroll and settle back when you stop), the badge in the middle is highlighted, and
   the dots jump to a badge. Without this script the badges are a plain swipe row. React
   can re-render the page after load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(sec) {
    var row = sec.querySelector('.tb-row');
    var items = row ? [].slice.call(row.querySelectorAll('.tb-item')) : [];
    if (!items.length) return;
    sec.setAttribute('data-tb', '1');
    sec.classList.add('tb-js');
    var dots = [].slice.call(sec.querySelectorAll('.tb-dot'));

    function active() {
      var mid = row.scrollLeft + row.clientWidth / 2, best = 0, bestD = Infinity;
      items.forEach(function (it, k) {
        var d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = k; }
      });
      items.forEach(function (it, k) { it.classList.toggle('is-active', k === best); });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === best ? 'true' : 'false'); });
    }

    dots.forEach(function (d, k) {
      d.addEventListener('click', function () {
        var it = items[k];
        row.scrollTo({ left: it.offsetLeft - (row.clientWidth - it.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
      });
    });

    // lean with the swipe: tilt follows scroll speed, then springs back
    var last = row.scrollLeft, tilt = 0, raf = 0, idle = 0;
    function frame() {
      var v = row.scrollLeft - last;
      last = row.scrollLeft;
      var target = Math.max(-14, Math.min(14, -v * 0.9));
      tilt += (target - tilt) * 0.25;
      row.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
      if (Math.abs(v) < 0.1 && Math.abs(tilt) < 0.05) { idle++; } else { idle = 0; }
      if (idle > 6) { row.style.setProperty('--tilt', '0deg'); raf = 0; return; }
      raf = requestAnimationFrame(frame);
    }
    row.addEventListener('scroll', function () {
      active();
      if (!reduce && !raf) { idle = 0; raf = requestAnimationFrame(frame); }
    }, { passive: true });
    window.addEventListener('resize', active);

    // start with the middle badge centred on narrow screens
    if (row.scrollWidth > row.clientWidth + 4) {
      var mid = items[Math.floor(items.length / 2)];
      row.scrollLeft = mid.offsetLeft - (row.clientWidth - mid.offsetWidth) / 2;
      last = row.scrollLeft;
    }
    active();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.tb:not([data-tb])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
