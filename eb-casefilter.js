/* Case Studies page:
   - A link to one case study, such as /case-studies#cs-nykaa-strategy from the course modules, scrolls
     to that card, opens its full story and briefly highlights it.
   - Jargon buster: words with a dotted underline show their plain-English meaning in a small bubble
     when tapped, hovered or focused.
   - "Swipe" topics: their cards rise into view as they are scrolled to. On phones each row is a swipe
     carousel (the card in focus is full size); on desktop a row with more than 3 cards shows 3 at a time.
     Both slide to the next card by themselves every few seconds and can be moved by hand (swipe, drag,
     arrows or dots); they pause while hovered or touched.
   Without this script the case studies still read normally and every card is visible. */
(function () {
  var phone = window.matchMedia ? window.matchMedia('(max-width: 767px)') : { matches: false };

  function goTo() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    var card = id && document.getElementById(id);
    if (!card || !card.classList.contains('csx-card')) return;
    card.classList.add('in', 'is-active');
    var d = card.querySelector('details');
    if (d) d.open = true;
    card.scrollIntoView({ block: 'start', inline: 'nearest' });
    card.classList.remove('csx-hit');
    void card.offsetWidth;
    card.classList.add('csx-hit');
  }

  // ---- jargon bubble ----
  function jargon() {
    var bubble = document.createElement('div');
    bubble.className = 'csx-bubble';
    bubble.setAttribute('role', 'tooltip');
    document.body.appendChild(bubble);
    var cur = null;
    function show(t) {
      if (cur && cur !== t) cur.classList.remove('on');
      cur = t;
      t.classList.add('on');
      bubble.innerHTML = '';
      var h = document.createElement('b');
      h.textContent = t.textContent;
      bubble.appendChild(h);
      bubble.appendChild(document.createTextNode(t.getAttribute('data-def')));
      var r = t.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      bubble.style.left = '0px'; bubble.style.top = '0px';
      bubble.classList.add('on');
      var bw = bubble.offsetWidth, bh = bubble.offsetHeight;
      var left = Math.max(10, Math.min(vw - bw - 10, r.left + r.width / 2 - bw / 2));
      var top = r.top - bh - 10;
      if (top < 70) top = r.bottom + 10; // below the word when there is no room above
      bubble.style.left = left + 'px';
      bubble.style.top = top + 'px';
    }
    function hide() {
      if (cur) cur.classList.remove('on');
      cur = null;
      bubble.classList.remove('on');
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.csx-term');
      if (t) { e.preventDefault(); show(t); } // a tap always shows it (hover may have opened it already)
      else hide();
    });
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('.csx-term');
      if (t && t !== cur) show(t);
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest && e.target.closest('.csx-term');
      if (t && t === cur && !(e.relatedTarget && t.contains(e.relatedTarget))) hide();
    });
    document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('csx-term')) show(e.target); });
    document.addEventListener('focusout', function (e) { if (e.target === cur) hide(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('csx-term')) { e.preventDefault(); show(e.target); }
    });
    window.addEventListener('scroll', hide, { passive: true });
    document.addEventListener('scroll', hide, { passive: true, capture: true });
  }

  // a card whose full story is open stops sticking in the stack, so the next card cannot cover it
  function openCards() {
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS') return;
      var card = d.closest && d.closest('.csx-card');
      if (card) card.classList.toggle('is-open', d.open);
    }, true);
  }

  // ---- swipe topics: rise-in on wider screens, carousel on phones ----
  function swipeTopics() {
    var topics = [].slice.call(document.querySelectorAll('.csx-topic.swipe'));
    if (!topics.length) return;
    var sec = document.querySelector('.cs-sec');
    if (!('IntersectionObserver' in window)) return; // cards simply stay visible
    if (sec) sec.classList.add('csx-rv');

    // rise-in: each card fades up when its row comes into view, one after another
    var seen = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        [].forEach.call(e.target.querySelectorAll('.csx-card'), function (c, i) { c.style.setProperty('--i', i); c.classList.add('in'); });
        seen.unobserve(e.target);
      });
    }, { threshold: 0.15 });

    var CHEV = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (d < 0 ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6') + '"/></svg>'; };
    topics.forEach(function (t) {
      var row = t.querySelector('.csx-grid'), dots = t.querySelector('.csx-dots');
      if (!row) return;
      seen.observe(row);
      var cards = [].slice.call(row.querySelectorAll('.csx-card'));
      if (!cards.length) return;
      cards[0].classList.add('is-active');
      var many = t.classList.contains('many');

      // phones: the card in focus is centred; desktop rows of many: the first visible card is at the start
      function mode() { return phone.matches ? 'center' : (many ? 'start' : ''); }
      function pos(i) {
        var c = cards[i];
        return mode() === 'center'
          ? c.offsetLeft - row.offsetLeft - (row.clientWidth - c.offsetWidth) / 2
          : c.offsetLeft - cards[0].offsetLeft;
      }
      function maxScroll() { return row.scrollWidth - row.clientWidth; }
      // card positions the row can actually reach (on desktop the last cards share one position)
      function stops() {
        var out = [], max = maxScroll();
        for (var i = 0; i < cards.length; i++) {
          if (mode() === 'start' && pos(i) > max + 2) break;
          out.push(i);
        }
        return out;
      }
      function current() {
        var x = row.scrollLeft, best = 0, dist = Infinity;
        stops().forEach(function (i) {
          var d = Math.abs(Math.max(0, Math.min(maxScroll(), pos(i))) - x);
          if (d < dist) { dist = d; best = i; }
        });
        return best;
      }
      function go(i) { row.scrollTo({ left: Math.max(0, Math.min(maxScroll(), pos(i))), behavior: 'smooth' }); }

      // arrows and dots
      var prev, next, built = '';
      function buildNav() {
        if (!dots) return;
        var m = mode(), list = m ? stops() : [];
        var key = m + ':' + list.length;
        if (key === built) return;
        built = key;
        dots.innerHTML = '';
        if (list.length < 2) return;
        prev = document.createElement('button');
        prev.type = 'button'; prev.className = 'csx-arr'; prev.innerHTML = CHEV(-1);
        prev.setAttribute('aria-label', 'Previous case study');
        prev.addEventListener('click', function () { hold(); var s = stops(), k = s.indexOf(current()); go(s[(k - 1 + s.length) % s.length]); });
        dots.appendChild(prev);
        list.forEach(function (i, n) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'csx-pg';
          b.setAttribute('aria-label', 'Show case study ' + (n + 1) + ' of ' + list.length);
          b.addEventListener('click', function () { hold(); go(i); });
          dots.appendChild(b);
        });
        next = document.createElement('button');
        next.type = 'button'; next.className = 'csx-arr'; next.innerHTML = CHEV(1);
        next.setAttribute('aria-label', 'Next case study');
        next.addEventListener('click', function () { hold(); step(); });
        dots.appendChild(next);
      }

      var raf = 0;
      function focus() {
        raf = 0;
        var cur = current(), list = stops();
        cards.forEach(function (c, i) { c.classList.toggle('is-active', i === cur); });
        if (dots) [].forEach.call(dots.querySelectorAll('.csx-pg'), function (b, n) { b.setAttribute('aria-current', list[n] === cur ? 'true' : 'false'); });
      }

      // next card, back to the first after the last
      function step() {
        var s = stops(), k = s.indexOf(current());
        go(k < 0 || k >= s.length - 1 ? s[0] : s[k + 1]);
      }

      // auto-slide every 3.5 s while the row is on screen and nobody is using it
      var visible = false, hover = false, until = 0;
      function hold() { until = Date.now() + 6000; }
      row.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
      row.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = false; });
      ['pointerdown', 'touchstart', 'wheel', 'keydown', 'focusin'].forEach(function (ev) { row.addEventListener(ev, hold, { passive: true }); });
      row.addEventListener('toggle', hold, true); // an opened story keeps the row still
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.5 }).observe(row);
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) setInterval(function () {
        if (!mode() || !visible || hover || document.hidden || Date.now() < until) return;
        if (maxScroll() < 4) return;
        if (row.querySelector('details[open]')) return;
        step();
      }, 3500);

      // mouse drag on desktop rows
      var drag = null;
      row.addEventListener('mousedown', function (e) { if (mode() !== 'start' || e.target.closest('summary,a,button,.csx-term')) return; drag = { x: e.clientX, s: row.scrollLeft, moved: false }; row.style.scrollSnapType = 'none'; row.style.scrollBehavior = 'auto'; });
      window.addEventListener('mousemove', function (e) { if (!drag) return; var dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.moved = true; row.scrollLeft = drag.s - dx; });
      window.addEventListener('mouseup', function () {
        if (!drag) return;
        var moved = drag.moved; drag = null;
        row.style.scrollSnapType = ''; row.style.scrollBehavior = '';
        if (moved) { hold(); go(current()); }
      });

      row.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(focus); }, { passive: true });
      window.addEventListener('resize', function () { buildNav(); focus(); });
      buildNav();
      focus();
    });
  }

  // ---- alumni coverflow in the "Unlock Your Skills" banner ----
  // the card in the middle is full size; the ones beside it sit back, smaller and faded. It moves to
  // the next card every 1.8 s while on screen, pauses on hover, and can be swiped or dragged.
  function coverflow() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    [].forEach.call(document.querySelectorAll('.csx-cf'), function (cf) {
      var cards = [].slice.call(cf.children), n = cards.length;
      if (n < 3) return;
      cf.classList.add('on');
      var cur = 0, hover = false, visible = true;
      function gap() { return cf.clientWidth < 420 ? 118 : 150; }
      function render() {
        var g = gap();
        cards.forEach(function (c, i) {
          var d = i - cur;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          var a = Math.abs(d);
          c.classList.toggle('is-c', d === 0);
          c.style.transform = 'translateX(' + d * g + 'px) translateZ(' + (-a * 80) + 'px) scale(' + (d === 0 ? 1.1 : 0.84) + ')';
          c.style.opacity = d === 0 ? 1 : a === 1 ? 0.45 : a === 2 ? 0.15 : 0;
          c.style.zIndex = 10 - a;
          c.setAttribute('aria-hidden', a > 1 ? 'true' : 'false');
        });
      }
      function go(step) { cur = (cur + step + n) % n; render(); }
      cf.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
      cf.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = false; });
      var x0 = null;
      cf.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
      cf.addEventListener('pointerup', function (e) {
        if (x0 === null) return;
        var dx = e.clientX - x0; x0 = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      });
      cf.addEventListener('dragstart', function (e) { e.preventDefault(); });
      if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.3 }).observe(cf);
      window.addEventListener('resize', render);
      render();
      if (!reduce) setInterval(function () { if (visible && !hover && !document.hidden) go(1); }, 1800);
    });
  }

  // ---- FAQ category tabs: show one category or all ----
  function faqTabs() {
    var box = document.querySelector('.csq');
    if (!box) return;
    var tabs = [].slice.call(box.querySelectorAll('.csq-tab')), cats = [].slice.call(box.querySelectorAll('.csq-cat'));
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var c = t.getAttribute('data-c');
        tabs.forEach(function (x) { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
        cats.forEach(function (k) { k.hidden = c !== '' && k.getAttribute('data-c') !== c; });
      });
    });
  }

  function start() {
    faqTabs();
    coverflow();
    swipeTopics();
    openCards();
    jargon();
    window.addEventListener('hashchange', goTo);
    goTo();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
