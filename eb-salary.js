/* Bhopal course page > Career Opportunities (salary map): each role's salary bar grows in as its
   row comes into view, and "Career path / Highest pay" re-orders the roles. Without this script
   the bars are simply drawn and the list stays in career-path order. React can re-render the
   page after load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(sec) {
    var list = sec.querySelector('.sl-list');
    if (!list) return;
    sec.setAttribute('data-sl', '1');
    var rows = [].slice.call(list.children);

    if (!reduce && 'IntersectionObserver' in window) {
      sec.classList.add('sl-js');
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.4 });
      rows.forEach(function (r) { io.observe(r); });
    } else {
      sec.classList.add('sl-js');
      rows.forEach(function (r) { r.classList.add('is-in'); });
    }

    // phones: the scale header sticks under the tab bar; square it off while it is stuck so the
    // rows scrolling behind do not show through its rounded corners
    var head = sec.querySelector('.sl-top');
    if (head) {
      var queued = false;
      var check = function () {
        queued = false;
        var stuck = getComputedStyle(head).position === 'sticky' &&
          head.getBoundingClientRect().top <= parseFloat(getComputedStyle(head).top) + 1 &&
          list.getBoundingClientRect().bottom > head.getBoundingClientRect().bottom;
        head.classList.toggle('is-stuck', stuck);
      };
      window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
      check();
    }

    var btns = [].slice.call(sec.querySelectorAll('.sl-sort button'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var by = b.getAttribute('data-sort');
        btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        var sorted = rows.slice().sort(function (p, q) {
          if (by === 'pay') return (+q.getAttribute('data-pay')) - (+p.getAttribute('data-pay')) || (+p.getAttribute('data-order')) - (+q.getAttribute('data-order'));
          return (+p.getAttribute('data-order')) - (+q.getAttribute('data-order'));
        });
        sorted.forEach(function (r) { list.appendChild(r); });
      });
    });
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.sl:not([data-sl])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
