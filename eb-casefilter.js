/* Case Studies > Category: the nine industry pills filter the case studies below by their tag
   (the .cs-tag text on each card). Selecting a pill shows only that industry; selecting it again
   shows everything. An industry with no case study yet shows a short "coming soon" note that
   points to the enquiry form. Without this script every case study is shown. */
(function () {
  function init(wrap) {
    var pills = [].slice.call(wrap.querySelectorAll('.cs-cat'));
    var list = document.querySelector('.cs-list');
    if (!pills.length || !list) return;
    wrap.setAttribute('data-cf', '1');
    var cards = [].slice.call(list.querySelectorAll('.cs-card'));
    var tagOf = function (c) { var t = c.querySelector('.cs-tag'); return t ? t.textContent.trim() : ''; };

    var empty = document.createElement('div');
    empty.className = 'cs-empty';
    empty.hidden = true;
    empty.innerHTML = '<b></b><p>We are putting this case study together. Tell us about your business and we will share how we would approach it.</p><a href="#ebuddha-enquiry">Discuss a similar project</a>';
    list.appendChild(empty);

    var cur = null;
    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var on = !cur || tagOf(c) === cur;
        c.hidden = !on;
        if (on) shown++;
      });
      empty.hidden = shown > 0;
      if (!shown) empty.querySelector('b').textContent = cur + ' case studies are coming soon';
      pills.forEach(function (p) { p.setAttribute('aria-pressed', p.getAttribute('data-cat') === cur ? 'true' : 'false'); });
    }
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        var c = p.getAttribute('data-cat');
        cur = cur === c ? null : c;
        apply();
      });
    });
    apply();
  }

  function start() {
    [].forEach.call(document.querySelectorAll('.cs-cats:not([data-cf])'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
