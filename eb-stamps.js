/* About > Our Recognition & Certifications: each stamp is "stamped" onto the page as it
   scrolls into view, then its VERIFIED postmark is inked on. Without this script, or with
   reduced motion, the stamps are simply shown. React can re-render the page after load, so
   new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var io = new IntersectionObserver(function (en) {
    var k = 0;
    en.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      io.unobserve(el);
      setTimeout(function () { el.classList.add('is-in'); }, 110 * k++); // stagger the ones that arrive together
    });
  }, { threshold: 0.35, rootMargin: '0px 0px -6% 0px' });

  function init(sec) {
    sec.setAttribute('data-rcx', '1');
    sec.classList.add('rcx-js');
    [].forEach.call(sec.querySelectorAll('.rcx-stamp'), function (s) { io.observe(s); });
  }
  function run() {
    [].forEach.call(document.querySelectorAll('.rcx:not([data-rcx])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
