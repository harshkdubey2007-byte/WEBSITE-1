/* Case Studies > Category: the topic pills filter the brand case studies below by their data-cat.
   "All" shows every case study; on "All" only the first rows show until "Show all" is pressed.
   Without this script every case study is listed. */
(function () {
  var FIRST = 9; // case studies shown under "All" before "Show all"

  function init(wrap) {
    var pills = [].slice.call(wrap.querySelectorAll('.cs-cat'));
    var list = document.querySelector('.csx-grid');
    if (!pills.length || !list) return;
    wrap.setAttribute('data-cf', '1');
    var cards = [].slice.call(list.querySelectorAll('.csx-card'));
    var showing = document.querySelector('.csx-showing b');
    var more = document.querySelector('.csx-all');
    var cur = 'all', open = false;

    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var on = cur === 'all' || c.getAttribute('data-cat') === cur;
        c.hidden = !on;
        c.classList.toggle('csx-cut', on && cur === 'all' && !open && shown >= FIRST);
        if (on) shown++;
      });
      if (showing) showing.textContent = shown;
      if (more) {
        more.hidden = cur !== 'all' || shown <= FIRST;
        more.setAttribute('aria-expanded', open ? 'true' : 'false');
        more.textContent = open ? 'Show fewer case studies' : 'Show all ' + shown + ' case studies';
      }
      pills.forEach(function (p) { p.setAttribute('aria-pressed', p.getAttribute('data-cat') === cur ? 'true' : 'false'); });
    }
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        cur = p.getAttribute('data-cat');
        open = false;
        apply();
      });
    });
    if (more) more.addEventListener('click', function () {
      open = !open;
      apply();
      if (!open) list.scrollIntoView({ block: 'start' });
    });

    // a link such as /case-studies#cs-nykaa-strategy (from the course modules) shows that case
    // study, opens its full story and scrolls to it
    function goTo() {
      var id = decodeURIComponent((location.hash || '').slice(1));
      var card = id && document.getElementById(id);
      if (!card || !card.classList.contains('csx-card')) return;
      cur = 'all';
      open = true;
      apply();
      var d = card.querySelector('details');
      if (d) d.open = true;
      card.scrollIntoView({ block: 'start' });
      card.classList.remove('csx-hit');
      void card.offsetWidth;
      card.classList.add('csx-hit');
    }
    window.addEventListener('hashchange', goTo);
    apply();
    goTo();
  }

  function start() {
    [].forEach.call(document.querySelectorAll('.cs-cats:not([data-cf])'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
