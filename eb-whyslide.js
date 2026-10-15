/* Bhopal course page > Why Learn Digital Marketing from eBuddha Digitech?: the six cards (design
   unchanged) become an auto-sliding carousel like the University & College Partnerships one:
   one card at a time, gliding sideways every 4.5 seconds and looping, with dots underneath.
   It pauses while the mouse is over it or something in it has focus, after a tap on a dot or a
   swipe (then carries on), and while it is off screen; with reduced motion it only moves when
   asked. Without this script the cards keep their original scroll-stacking layout. React can
   re-render the page after load, so a new copy of the cards is set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EVERY = 4500, GAP_DESK = 24, GAP_MOB = 16;
  var CSS =
    '.wl-vp{overflow:hidden;margin:0 0 20px}' +
    '.wl-on.sticky-steps-wrapper-box{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;gap:' + GAP_DESK + 'px!important;padding:0!important;margin:0!important;overflow:visible!important;transition:transform .8s cubic-bezier(.22,.61,.36,1);will-change:transform}' +
    '.wl-on.sticky-steps-wrapper-box>div{position:relative!important;top:auto!important;flex:0 0 100%;min-width:0}' +
    '.wl-on.sticky-steps-wrapper-box>div>.step-sticky-card{width:100%;min-width:0!important;max-width:none!important}' +
    '.wl-dots{display:flex;justify-content:center;gap:10px;margin:0 0 28px}' +
    '.wl-dots button{width:10px;height:10px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.35);cursor:pointer;transition:background .3s,transform .3s}' +
    '.wl-dots button.on{background:#fff;transform:scale(1.25)}' +
    '.wl-dots button:focus-visible{outline:2px solid #FFC24B;outline-offset:3px}' +
    '@media (max-width:767px){.wl-vp{margin:0 16px 18px}.wl-on.sticky-steps-wrapper-box{gap:' + GAP_MOB + 'px!important}}' +
    '@media (prefers-reduced-motion:reduce){.wl-on.sticky-steps-wrapper-box{transition:none}}';

  function init(track) {
    var slides = [].slice.call(track.children);
    if (slides.length < 2) return;
    track.setAttribute('data-wl', '1');
    if (!document.getElementById('wl-css')) {
      var st = document.createElement('style');
      st.id = 'wl-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var vp = document.createElement('div');
    vp.className = 'wl-vp';
    vp.setAttribute('role', 'region');
    vp.setAttribute('aria-roledescription', 'carousel');
    vp.setAttribute('aria-label', track.getAttribute('data-wl-label') || 'Why learn with eBuddha Digitech');
    track.parentNode.insertBefore(vp, track);
    vp.appendChild(track);
    track.classList.add('wl-on');
    // the slides sit off to the side, where lazy loading would leave them blank as they glide in
    [].forEach.call(track.querySelectorAll('img[loading="lazy"]'), function (im) { im.loading = 'eager'; });
    var dots = document.createElement('div');
    dots.className = 'wl-dots';
    vp.parentNode.insertBefore(dots, vp.nextSibling);

    var page = 0, timer = null, visible = false, hover = false, idleUntil = 0;
    function gap() { return window.innerWidth <= 767 ? GAP_MOB : GAP_DESK; }
    function go(i) {
      page = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-page * (vp.clientWidth + gap())) + 'px)';
      slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k === page ? 'false' : 'true'); });
      [].forEach.call(dots.children, function (d, k) {
        d.classList.toggle('on', k === page);
        d.setAttribute('aria-current', k === page ? 'true' : 'false');
      });
    }
    slides.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show card ' + (i + 1) + ' of ' + slides.length);
      b.addEventListener('click', function () { nudge(); go(i); });
      dots.appendChild(b);
    });

    function nudge() { idleUntil = Date.now() + EVERY; }
    function tick() {
      clearInterval(timer); timer = null;
      if (reduce || !visible || hover || document.hidden) return;
      timer = setInterval(function () { if (Date.now() >= idleUntil) go(page + 1); }, EVERY);
    }

    // swipe on phones
    var sx = 0, sy = 0;
    vp.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; nudge(); }, { passive: true });
    vp.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { nudge(); go(page + (dx < 0 ? 1 : -1)); }
    }, { passive: true });

    vp.addEventListener('mouseenter', function () { hover = true; tick(); });
    vp.addEventListener('mouseleave', function () { hover = false; tick(); });
    vp.addEventListener('focusin', function () { hover = true; tick(); });
    vp.addEventListener('focusout', function () { hover = false; tick(); });
    document.addEventListener('visibilitychange', tick);
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { go(page); }, 120); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; tick(); }, { threshold: 0.35 }).observe(vp);
    } else { visible = true; }
    go(0);
    tick();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.sticky-steps-wrapper-box:not([data-wl])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
