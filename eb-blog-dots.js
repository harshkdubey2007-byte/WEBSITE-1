/* Latest Blogs: dot indicators under the swipe row (shown on tablet and phone only, see .eb-bl-dots in the section CSS) */
(function () {
  function run() {
    var grid = document.querySelector('.eb-bl-grid');
    if (!grid || grid.parentNode.querySelector('.eb-bl-dots')) return;
    var cards = grid.querySelectorAll('.eb-bl-card');
    if (cards.length < 2) return;

    var wrap = document.createElement('div');
    wrap.className = 'eb-bl-dots';
    var dots = [];
    for (var i = 0; i < cards.length; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'eb-bl-dot';
        b.setAttribute('aria-label', 'Show blog ' + (n + 1) + ' of ' + cards.length);
        b.addEventListener('click', function () {
          var step = cards[1].offsetLeft - cards[0].offsetLeft;
          var max = grid.scrollWidth - grid.clientWidth;
          grid.scrollTo({ left: Math.min(n * step, max), behavior: 'smooth' });
        });
        wrap.appendChild(b);
        dots.push(b);
      })(i);
    }
    grid.insertAdjacentElement('afterend', wrap);

    function update() {
      var step = cards[1].offsetLeft - cards[0].offsetLeft;
      var max = grid.scrollWidth - grid.clientWidth;
      var idx = grid.scrollLeft >= max - 4 ? cards.length - 1 : Math.round(grid.scrollLeft / (step || 1));
      idx = Math.max(0, Math.min(cards.length - 1, idx));
      for (var k = 0; k < dots.length; k++) {
        dots[k].className = 'eb-bl-dot' + (k === idx ? ' on' : '');
        if (k === idx) dots[k].setAttribute('aria-current', 'true'); else dots[k].removeAttribute('aria-current');
      }
    }
    grid.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
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
