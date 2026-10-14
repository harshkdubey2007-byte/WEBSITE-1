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
    '@media (prefers-reduced-motion:reduce){.eb-ph-sec .highlight-section,.eb-ph-sec .sticky-highlight-image{transition:none}}';
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
    if (img.getAttribute('src') === ph.src) { img.style.opacity = ''; return; }
    img.style.opacity = '0';
    setTimeout(function () {
      img.onload = function () { img.style.opacity = ''; };
      img.setAttribute('src', ph.src);
      img.setAttribute('alt', ph.alt);
      img.style.objectPosition = ph.pos;
      if (img.complete) img.style.opacity = '';
    }, 180);
  }

  function update() {
    ticking = false;
    var p = parts();
    if (!p) return;
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
