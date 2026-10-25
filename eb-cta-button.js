/* eBuddha Digitech: gives the "Get Free Consultation", "Talk to Program Advisor" and "Learn & Get Help"
   buttons the blue call-to-action look from eb-cta-button.css. They are found by their text, because they
   come from several different components (footer, hero, placement section, FAQ tabs). New copies that
   appear later (menus and sections that are drawn after load) are tagged too. */
(function () {
  if (window.__ebCtaBtn) return;
  window.__ebCtaBtn = 1;
  var LABELS = { 'get free consultation': 1, 'talk to program advisor': 1, 'learn & get help': 1 };
  var TYPE = { 'login': 1, 'join for free': 1, 'read more': 1, 'send on whatsapp': 1 };
  var timer = null;

  // the colour the button really sits on (walks up past transparent backgrounds)
  function isLight(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) > 150;
    }
    return true;
  }

  function tag() {
    timer = null;
    var els = document.querySelectorAll('a,button');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList.contains('eb-cta-blue') || el.classList.contains('eb-cta-type')) continue;
      if (el.children.length > 3) continue;
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (TYPE[t]) {
        el.classList.add('eb-cta-type');
        if (isLight(el)) el.classList.add('eb-shine-light');
        continue;
      }
      if (!LABELS[t]) continue;
      el.classList.add('eb-cta-blue');
      if (el.querySelector('.medium-btn-grident,.button-grident')) el.classList.add('eb-shine-native');
    }
  }
  function soon() { if (!timer) timer = setTimeout(tag, 120); }

  tag();
  if (window.MutationObserver) {
    new MutationObserver(soon).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('DOMContentLoaded', tag);
  window.addEventListener('load', tag);
})();
