/*eb-services*/(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(){
    var page = document.querySelector('.eb-svcpage');
    if (!page) return;

    /* reveal each block once it has come far enough into view */
    /* the flip cards are tall, so on a phone they must be well up the screen before they flip,
       otherwise the fold happens below the fold where nobody sees it */
    var flips = [].slice.call(page.querySelectorAll('#seo-services .sx-g3>.sx-card, #pm-services .sx-g3>.sx-card, #web-services .sx-g3>.sx-card, [id$="-included"] .sx-incl'));
    var items = [].filter.call(page.querySelectorAll('.reveal:not(.eb-off-row)'), function (el) { return flips.indexOf(el) < 0; });
    if (reduce || !('IntersectionObserver' in window)) {
      for (var f0 = 0; f0 < flips.length; f0++) flips[f0].classList.add('in');
    } else if (flips.length) {
      var phone = window.matchMedia && window.matchMedia('(max-width:767px)').matches;
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting && e.boundingClientRect.top >= 0) return;
          e.target.classList.add('in');
          fio.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -' + (phone ? 36 : 14) + '% 0px', threshold: 0.01 });
      for (var f1 = 0; f1 < flips.length; f1++) fio.observe(flips[f1]);
    }
    if (reduce || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('in');
    } else {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
      for (var j = 0; j < items.length; j++) io.observe(items[j]);
    }

    /* the client quotes loop, so the five cards are duplicated once and the
       track travels exactly half its width */
    var track = page.querySelector('.eb-belt-track');
    if (track && !track.dataset.doubled) {
      var cards = [].slice.call(track.children);
      cards.forEach(function(c){ track.appendChild(c.cloneNode(true)); });
      track.dataset.doubled = '1';
    }

    /* the rail beside the four steps fills as the section passes, and the step
       level with it lights up */
    var steps = page.querySelector('.eb-steps');
    if (steps) {
      var fill = steps.querySelector('.eb-rail-fill');
      var rows = [].slice.call(steps.querySelectorAll('.eb-step'));
      var rail = steps.querySelector('.eb-rail');
      var tick = function(){
        var railBox = rail.getBoundingClientRect();
        var mark = window.innerHeight * 0.55;
        var run = Math.min(1, Math.max(0, (mark - railBox.top) / railBox.height));
        fill.style.height = (run * 100) + '%';
        var edge = railBox.top + railBox.height * run;
        rows.forEach(function(r){
          var box = r.getBoundingClientRect();
          r.classList.toggle('on', box.top <= edge + 8);
        });
      };
      window.addEventListener('scroll', tick, { passive: true });
      window.addEventListener('resize', tick);
      tick();
    }

    /* The offering pairs wait until the row is properly on screen before the two cards
       shift in from their sides - triggering at the bottom edge put the whole movement
       where nobody was looking.

       Unlike the rest of the page this one is not a one-shot: the row keeps being
       watched, so the cards shift back out the way they came when it leaves and play
       again from the start on the way back. */
    var offRows = page.querySelectorAll('.eb-off-row');
    if (offRows.length) {
      if (reduce || !('IntersectionObserver' in window)) {
        for (var q = 0; q < offRows.length; q++) offRows[q].classList.add('in');
      } else {
        var oio = new IntersectionObserver(function(es){
          es.forEach(function(e){ e.target.classList.toggle('in', e.isIntersecting); });
        }, { rootMargin: '0px 0px -30% 0px', threshold: 0.01 });
        for (var w = 0; w < offRows.length; w++) oio.observe(offRows[w]);
      }
      /* on a phone a pair is two tall cards one under the other, so each card flips on its own
         when it is well up the screen (the second one would otherwise flip out of sight) */
      var offCards = page.querySelectorAll('.eb-off-card');
      if (reduce || !('IntersectionObserver' in window)) {
        for (var oc = 0; oc < offCards.length; oc++) offCards[oc].classList.add('eb-card-in');
      } else if (window.matchMedia && window.matchMedia('(max-width:767px)').matches) {
        var cio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { e.target.classList.toggle('eb-card-in', e.isIntersecting || e.boundingClientRect.top < 0); });
        }, { rootMargin: '0px 0px -36% 0px', threshold: 0.01 });
        for (var oc2 = 0; oc2 < offCards.length; oc2++) cio.observe(offCards[oc2]);
      }
    }

    /* the tools rail draws its dotted line once, then the logos arrive in order */
    var tools = page.querySelector('.eb-tools');
    if (tools) {
      if (reduce || !('IntersectionObserver' in window)) tools.classList.add('in');
      else {
        var tio = new IntersectionObserver(function(es){
          es.forEach(function(e){
            if (!e.isIntersecting) return;
            e.target.classList.add('in');
            tio.unobserve(e.target);
          });
        }, { rootMargin: '0px 0px -15% 0px', threshold: 0.15 });
        tio.observe(tools);
      }
    }

    /* the process spine fills as the section passes and each step arrives at its node */
    var proc = page.querySelector('.eb-proc-wrap');
    if (proc) {
      var spineFill = proc.querySelector('.eb-proc-fill');
      var stepsList = [].slice.call(proc.querySelectorAll('.eb-proc-step'));
      var spine = proc.querySelector('.eb-proc-spine');
      var runProc = function(){
        var box = spine.getBoundingClientRect();
        var mark = window.innerHeight * 0.62;
        var run = Math.min(1, Math.max(0, (mark - box.top) / box.height));
        spineFill.style.height = (run * 100) + '%';
        var edge = box.top + box.height * run;
        stepsList.forEach(function(s){
          var node = s.querySelector('.eb-proc-node').getBoundingClientRect();
          s.classList.toggle('on', node.top <= edge + 10);
        });
      };
      window.addEventListener('scroll', runProc, { passive: true });
      window.addEventListener('resize', runProc);
      runProc();
    }

    /* the sticky index marks whichever service you are level with, and keeps that
       chip scrolled into view so the bar always shows where you are */
    var jump = page.querySelector('.eb-jump');
    if (jump) {
      var links = [].slice.call(jump.querySelectorAll('a'));
      var targets = links.map(function(a){ return document.getElementById(a.getAttribute('href').slice(1)); });
      var active = -1;
      var spy = function(){
        var mark = (jump.getBoundingClientRect().bottom || 0) + 40;
        var found = -1;
        for (var k = 0; k < targets.length; k++) {
          if (targets[k] && targets[k].getBoundingClientRect().top <= mark) found = k;
        }
        if (found === active) return;
        if (active > -1) links[active].classList.remove('on');
        active = found;
        if (active > -1) {
          links[active].classList.add('on');
          var a = links[active], bar = jump.querySelector('ul');
          var want = a.offsetLeft - bar.clientWidth / 2 + a.offsetWidth / 2;
          bar.scrollTo({ left: Math.max(0, want), behavior: reduce ? 'auto' : 'smooth' });
        }
      };
      window.addEventListener('scroll', spy, { passive: true });
      window.addEventListener('resize', spy);
      spy();
    }

    /* the enquiry goes to the team on WhatsApp */
    var form = page.querySelector('.eb-form');
    if (form) {
      form.addEventListener('submit', function(e){
        e.preventDefault();
        var NL = String.fromCharCode(10), g = function(n){ var el = form.elements[n]; return el && el.value ? el.value : '-'; };
        var t = 'Hi eBuddha Digitech, I would like help with a service.' + NL + 'Name: ' + g('name') + NL + 'Business: ' + g('company') + NL + 'Phone: ' + g('phone') + NL + 'Email: ' + g('email') + NL + 'Service: ' + g('service') + (form.elements['message'] ? NL + 'Message: ' + g('message') : '');
        window.open('https://wa.me/918461958162?text=' + encodeURIComponent(t), '_blank', 'noopener');
        var said = form.querySelector('.eb-f-said');
        if (!said) {
          said = document.createElement('p');
          said.className = 'eb-f-said';
          said.style.cssText = 'margin-top:14px;padding:12px 14px;border-radius:9px;background:#EAF0FF;border:1px solid #C7D6FF;font-size:14px;line-height:1.6;color:#1E3A8A';
          form.appendChild(said);
        }
        said.textContent = 'Thank you. Your details are ready in WhatsApp; press send there and we will reply soon.';
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
