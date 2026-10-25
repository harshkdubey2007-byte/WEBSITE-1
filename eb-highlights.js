/* eBuddha Digitech - "Program Highlights" on desktop. The right-hand picture is sticky but the page is
   static, so it always showed the first photo. As you scroll, the highlight nearest the middle of the
   screen becomes the active one: its photo fades in on the right and the other highlights dim a little.
   Phones keep their own layout (a photo inside each card). On every screen the photos get a thin
   brand-blue border and a soft blue shadow. */
(function () {
  if (window.__ebHighlights) return;
  window.__ebHighlights = 1;

  var CSS = '.eb-ph-sec .sticky-highlight-image,.eb-ph-sec .highlight-img{box-sizing:border-box;border:1px solid rgba(25,76,255,.5);box-shadow:0 8px 22px rgba(25,76,255,.14)}' +
    '@media (min-width:992px){' +
    '.eb-ph-sec .highlight-section{transition:opacity .35s ease}' +
    '.eb-ph-sec.eb-hl-on .highlight-section{opacity:.45}' +
    '.eb-ph-sec.eb-hl-on .highlight-section.eb-on{opacity:1}' +
    '.eb-ph-sec .sticky-highlight-image{transition:opacity .3s ease}' +
    '}' +
    '.eb-ph-sec .sticky-highlight-image{backface-visibility:hidden;transition:opacity .3s ease,transform .38s cubic-bezier(.3,.7,.25,1)}' +
    '.eb-ph-sec .highlight-section.eb-flip{transform:perspective(900px) translateY(34px) rotateX(-62deg);transform-origin:50% 0;backface-visibility:hidden;transition:transform 1.05s cubic-bezier(.3,.85,.35,1.1),opacity .35s ease}' +
    '.eb-ph-sec .highlight-section.eb-flip.eb-fin{transform:none}' +
    '@media (prefers-reduced-motion:reduce){.eb-ph-sec .highlight-section,.eb-ph-sec .sticky-highlight-image{transition:none}.eb-ph-sec .highlight-section.eb-flip{transform:none}}';
  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  var cur = -1, ticking = false, preloaded = false;
  var desk = window.matchMedia('(min-width:992px)');

  function parts() {
    var sec = document.querySelector('.eb-ph-sec');
    if (!sec) return null;
    var cards = sec.querySelectorAll('.highlights-content-wrapper .highlight-section');
    var img = sec.querySelector('.sticky-highlight-image');
    if (!cards.length || !img) return null;
    return { sec: sec, cards: cards, img: img };
  }

  // each card carries its own photo (shown on phones); reuse it for the desktop picture
  function photo(card) {
    var p = card.querySelector('.responsive-highlight-img img');
    return p ? { src: p.getAttribute('src'), alt: p.getAttribute('alt') || '', pos: p.style.objectPosition } : null;
  }

  function show(p, i) {
    var ph = photo(p.cards[i]);
    if (!ph) return;
    var img = p.img;
    if (img.getAttribute('src') === ph.src) { img.style.transform = ''; return; }
    img.style.transform = 'perspective(900px) rotateY(90deg)';
    setTimeout(function () {
      img.onload = function () { img.style.transform = ''; };
      img.setAttribute('src', ph.src);
      img.setAttribute('alt', ph.alt);
      img.style.objectPosition = ph.pos;
      if (img.complete) img.style.transform = '';
    }, 190);
  }

  // each highlight card folds down into place the first time it comes into view
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var flipIO = null;
  function arm(cards) {
    if (reduce || !('IntersectionObserver' in window)) return;
    if (!flipIO) flipIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add('eb-fin'); flipIO.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -' + (window.innerWidth < 768 ? 34 : 8) + '% 0px', threshold: 0.02 });
    Array.prototype.forEach.call(cards, function (c) {
      if (c.getAttribute('data-eb-flip')) return;
      c.setAttribute('data-eb-flip', '1');
      c.classList.add('eb-flip');
      flipIO.observe(c);
    });
    // safety net: nothing may stay folded away
    setTimeout(function () { Array.prototype.forEach.call(cards, function (c) { if (c.getBoundingClientRect().top < window.innerHeight * 1.1) c.classList.add('eb-fin'); }); }, 4000);
  }

  function update() {
    ticking = false;
    var p = parts();
    if (!p) return;
    arm(p.cards);
    if (!desk.matches) { p.sec.classList.remove('eb-hl-on'); return; }
    p.img.setAttribute('loading', 'eager');
    if (!preloaded) {
      preloaded = true;
      Array.prototype.forEach.call(p.cards, function (c) { var ph = photo(c); if (ph) new Image().src = ph.src; });
    }
    var line = window.innerHeight * 0.45, active = 0;
    for (var i = 0; i < p.cards.length; i++) {
      if (p.cards[i].getBoundingClientRect().top <= line) active = i;
    }
    p.sec.classList.add('eb-hl-on');
    for (var j = 0; j < p.cards.length; j++) p.cards[j].classList.toggle('eb-on', j === active);
    if (active !== cur || !p.img.dataset.ebHl) {
      cur = active;
      p.img.dataset.ebHl = '1';
      show(p, active);
    }
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update);
  else update();
})();
