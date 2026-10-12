/* About > Services & Solutions (growth funnel).
   Desktop and tablet: the funnel bands are tabs that show one stage at a time in the panel
   beside or below (click, or arrow keys / Home / End when a band has focus), and "Next" in each
   panel steps down the funnel. Until someone uses it, it also steps through the stages by
   itself while the funnel is on screen (never with reduced motion).
   Phones (767px and below): each stage's details move under its own row and the list works as
   an accordion, one row open at a time, no auto-play.
   Without this script every stage is listed under the funnel. React can re-render the page
   after load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq = window.matchMedia ? window.matchMedia('(max-width: 767px)') : { matches: false };

  function init(sec) {
    var bands = [].slice.call(sec.querySelectorAll('.gf-band'));
    var panels = bands.map(function (b) { return sec.querySelector('#' + b.getAttribute('aria-controls')); });
    var list = sec.querySelector('.gf-fun'), home = sec.querySelector('.gf-panels'), body = sec.querySelector('.gf-body');
    if (!bands.length || panels.indexOf(null) >= 0 || !list || !home || !body) return;
    sec.setAttribute('data-gf', '1');
    sec.classList.add('gf-js');
    var items = bands.map(function (b) { return b.parentNode; });
    var cur = 0;      // stage showing (tabs) or open (accordion); -1 = all closed
    var acc = null;   // accordion mode on?

    /* ---------- tabs (desktop / tablet) ---------- */
    function show(k, opts) {
      opts = opts || {};
      cur = k;
      bands.forEach(function (b, i) {
        var on = i === k;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        panels[i].classList.toggle('is-on', on);
        panels[i].setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      if (opts.focusTab) bands[k].focus();
      if (opts.reveal) {
        var r = panels[k].getBoundingClientRect();
        if (r.top > window.innerHeight * 0.7 || r.top < 70) panels[k].scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      }
      if (opts.focusPanel) panels[k].focus({ preventScroll: true });
    }

    /* ---------- accordion (phones) ---------- */
    function setOpen(k, reveal) {
      cur = k;
      bands.forEach(function (b, i) {
        var on = i === k;
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        items[i].classList.toggle('is-open', on);
        panels[i].hidden = !on;
      });
      if (reveal && k >= 0) {
        var top = bands[k].getBoundingClientRect().top;
        if (top < 80) window.scrollBy({ top: top - 86, behavior: reduce ? 'auto' : 'smooth' });
      }
    }

    function layout() {
      var want = !!mq.matches;
      if (want === acc) return;
      acc = want;
      halt();
      sec.classList.toggle('gf-acc', acc);
      if (acc) {
        list.removeAttribute('role');
        list.removeAttribute('aria-orientation');
        items.forEach(function (li, i) { li.removeAttribute('role'); li.appendChild(panels[i]); });
        bands.forEach(function (b) { b.removeAttribute('role'); b.removeAttribute('aria-selected'); b.tabIndex = 0; });
        panels.forEach(function (p, i) {
          p.setAttribute('role', 'region');
          p.setAttribute('aria-labelledby', bands[i].id);
          p.removeAttribute('aria-hidden');
          p.classList.remove('is-on');
        });
        setOpen(cur);
      } else {
        list.setAttribute('role', 'tablist');
        list.setAttribute('aria-orientation', 'vertical');
        items.forEach(function (li, i) { li.setAttribute('role', 'presentation'); li.classList.remove('is-open'); home.appendChild(panels[i]); });
        bands.forEach(function (b) { b.setAttribute('role', 'tab'); b.removeAttribute('aria-expanded'); });
        panels.forEach(function (p, i) {
          p.hidden = false;
          p.setAttribute('role', 'tabpanel');
          p.setAttribute('aria-labelledby', bands[i].id);
          p.tabIndex = -1;
        });
        show(cur < 0 ? 0 : cur);
        tick();
      }
    }

    bands.forEach(function (b, i) {
      b.addEventListener('click', function () {
        if (acc) setOpen(cur === i ? -1 : i, true);
        else show(i, { reveal: window.innerWidth < 992 });
      });
      b.addEventListener('keydown', function (e) {
        if (acc) return; // plain buttons in accordion mode
        var n = bands.length;
        var k = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? i + 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
        if (k === null) return;
        e.preventDefault();
        show((k + n) % n, { focusTab: true });
      });
    });
    panels.forEach(function (p, i) {
      var next = p.querySelector('.gf-next');
      if (next) next.addEventListener('click', function () { show((i + 1) % panels.length, { reveal: true, focusPanel: true }); });
    });

    /* ---------- auto-play (tabs mode only) ---------- */
    var timer = null, visible = false, hover = false, stopped = reduce || !('IntersectionObserver' in window);
    function halt() { clearTimeout(timer); timer = null; sec.classList.remove('is-auto'); }
    function tick() {
      halt();
      if (stopped || acc || !visible || hover) return;
      void sec.offsetWidth; // restart the bar on the active band
      sec.classList.add('is-auto');
      timer = setTimeout(function () { show((cur + 1) % bands.length); tick(); }, 4500);
    }
    function stop() { stopped = true; halt(); }
    ['pointerdown', 'keydown', 'touchstart', 'focusin'].forEach(function (ev) { body.addEventListener(ev, stop, { passive: true }); });
    body.addEventListener('mouseenter', function () { hover = true; halt(); });
    body.addEventListener('mouseleave', function () { hover = false; tick(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      tick();
    }, { threshold: 0.6 }).observe(list); // only while the funnel itself is in view

    if (mq.addEventListener) mq.addEventListener('change', layout); else if (mq.addListener) mq.addListener(layout);
    layout();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.gf:not([data-gf])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
