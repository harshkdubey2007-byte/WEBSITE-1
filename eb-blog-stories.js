/* Home > Latest Blogs: on tablet and phone the posts play like stories. Progress bars fill up
   (5s each) and move to the next post, tapping the right of the image goes forward, the left goes back,
   swiping works too, and pressing and holding pauses. On desktop the posts are a magazine grid
   and every 5 seconds the next post fades in as the large featured one (paused while the
   mouse is over the posts, while they are off screen, and never with reduced motion). Without it, phones get a swipe row.
   React can re-render the home page after load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq = window.matchMedia ? window.matchMedia('(max-width: 991px)') : { matches: false };

  function init(sec) {
    var stage = sec.querySelector('.bx-stage');
    var cards = stage ? [].slice.call(stage.querySelectorAll('.bx-card')) : [];
    var n = cards.length;
    if (n < 2) return;
    sec.setAttribute('data-bx', '1');

    var bars = sec.querySelector('.bx-bars');
    var segs = bars ? [].slice.call(bars.children) : [];
    var i = 0, visible = false, held = false, suppress = false;

    stage.classList.add('bx-js');
    if (reduce) stage.classList.add('bx-still');

    function paint() {
      cards.forEach(function (c, k) {
        var on = k === i;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-hidden', mq.matches && !on ? 'true' : 'false');
      });
      segs.forEach(function (s, k) {
        s.classList.remove('on');
        s.classList.toggle('done', k < i);
      });
      if (segs[i]) {
        void segs[i].offsetWidth; // restart the fill animation
        segs[i].classList.add('on');
      }
      state();
    }

    function state() {
      stage.classList.toggle('is-paused', held || !visible || document.hidden);
    }

    function go(k) { i = (k + n) % n; paint(); }

    segs.forEach(function (s) {
      s.addEventListener('animationend', function () { if (s.classList.contains('on')) go(i + 1); });
    });

    // tap / swipe / hold on the image area
    var down = false, sx = 0, sy = 0, t0 = 0;
    stage.addEventListener('pointerdown', function (e) {
      if (!mq.matches || !e.target.closest('.bx-img')) return;
      down = true; sx = e.clientX; sy = e.clientY; t0 = Date.now();
      held = true; state();
    });
    function up(e) {
      if (!down) return;
      down = false; held = false; state();
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        suppress = true;
        go(dx < 0 ? i + 1 : i - 1);
      } else if (Date.now() - t0 > 450 || Math.abs(dy) > 10) {
        suppress = true; // it was a hold or a scroll, not a tap
      }
    }
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', function () { down = false; held = false; state(); });

    cards.forEach(function (c) {
      var img = c.querySelector('.bx-img');
      if (!img) return;
      img.addEventListener('click', function (e) {
        if (!mq.matches) return;
        e.preventDefault();
        if (suppress) { suppress = false; return; }
        var r = stage.getBoundingClientRect();
        go(e.clientX - r.left < r.width * 0.35 ? i - 1 : i + 1);
      });
      img.addEventListener('contextmenu', function (e) { if (mq.matches) e.preventDefault(); });
    });

    stage.addEventListener('keydown', function (e) {
      if (!mq.matches) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; state(); }, { threshold: 0.5 }).observe(stage);
    } else {
      visible = true;
    }
    document.addEventListener('visibilitychange', state);
    if (mq.addEventListener) mq.addEventListener('change', paint);

    // desktop: every 5 seconds the next post becomes the large featured card
    if (!document.getElementById('bx-rot-css')) {
      var st = document.createElement('style');
      st.id = 'bx-rot-css';
      st.textContent = '@media (min-width:992px){.bx-stage>.bx-card{transition:opacity .35s,box-shadow .3s,transform .3s}.bx-stage.bx-fade>.bx-card{opacity:0}}';
      document.head.appendChild(st);
    }
    var hover = false;
    stage.addEventListener('mouseenter', function () { hover = true; });
    stage.addEventListener('mouseleave', function () { hover = false; });
    stage.addEventListener('focusin', function () { hover = true; });
    stage.addEventListener('focusout', function () { hover = false; });
    setInterval(function () {
      if (mq.matches || reduce || hover || !visible || document.hidden) return;
      stage.classList.add('bx-fade');
      setTimeout(function () {
        var first = stage.querySelector('.bx-card');
        if (first) stage.appendChild(first); // the next post moves into the featured spot
        stage.classList.remove('bx-fade');
      }, 350);
    }, 5000);

    paint();
    sec.classList.add('is-ready');
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.bx:not([data-bx])'), init);
  }

  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
