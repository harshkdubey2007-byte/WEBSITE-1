/* About > What Our Learners and Clients Say: the Learners / Clients tabs (click, or arrow
   keys when a tab has focus), "Read More" on long reviews, and the dots under the swipe row
   on phones. Without this script both groups are simply listed one after the other. React
   can re-render the page after load, so new copies of the section are set up too. */
(function () {
  function init(sec) {
    sec.setAttribute('data-rv', '1');
    sec.classList.add('rv-js');
    var tabs = [].slice.call(sec.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return sec.querySelector('#' + t.getAttribute('aria-controls')); });

    function show(k, focus) {
      tabs.forEach(function (t, i) {
        var on = i === k;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) tabs[k].focus();
      dots(panels[k]);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (k === null) return;
        e.preventDefault();
        show((k + tabs.length) % tabs.length, true);
      });
    });

    // Read more: only on reviews that are actually cut off
    [].forEach.call(sec.querySelectorAll('.rv-card'), function (card) {
      var q = card.querySelector('.rv-q'), btn = card.querySelector('.rv-more');
      if (!q || !btn) return;
      function check() { btn.hidden = card.classList.contains('is-open') ? false : q.scrollHeight <= q.clientHeight + 2; }
      btn.addEventListener('click', function () {
        var open = card.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.textContent = open ? 'Show less' : 'Read More';
      });
      check();
      window.addEventListener('resize', check);
      card._rvCheck = check;
    });

    // dots under the swipe row (phones)
    function dots(panel) {
      var row = panel.querySelector('.rv-row'), wrap = panel.querySelector('.rv-dots');
      if (!row || !wrap) return;
      [].forEach.call(panel.querySelectorAll('.rv-card'), function (c) { if (c._rvCheck) c._rvCheck(); });
      if (wrap.childElementCount) return;
      var cards = [].slice.call(row.children);
      cards.forEach(function (c, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rv-dot';
        b.setAttribute('aria-label', 'Show review ' + (i + 1) + ' of ' + cards.length);
        b.addEventListener('click', function () { row.scrollTo({ left: c.offsetLeft - row.offsetLeft - 16, behavior: 'smooth' }); });
        wrap.appendChild(b);
      });
      function sync() {
        var mid = row.scrollLeft + row.clientWidth / 2, best = 0, bd = Infinity;
        cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft - row.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
        [].forEach.call(wrap.children, function (d, i) { d.setAttribute('aria-current', i === best ? 'true' : 'false'); });
      }
      row.addEventListener('scroll', sync, { passive: true });
      sync();
    }
    show(0);
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.rv:not([data-rv])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
