/* eBuddha Digitech - course module cards ("Module 1 - Duration: ..."). The page is static, so the cards'
   arrow buttons had nothing behind them. Clicking a card's header now opens it and closes the one that was
   open; clicking the open card closes it. One click handler on the document, so it keeps working if the
   cards are re-rendered. */
(function () {
  if (window.__ebModules) return;
  window.__ebModules = 1;

  function setOpen(item, open) {
    var btn = item.querySelector('.accordion-button');
    var body = item.querySelector('.accordion-collapse');
    if (!btn || !body) return;
    item.classList.toggle('active-item', open);
    btn.classList.toggle('collapsed', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.classList.toggle('show', open);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.da-curr-accordion .accordion-button');
    if (!btn) return;
    var item = btn.closest('.da-curr-accordion');
    var list = item.parentNode;
    var opening = btn.getAttribute('aria-expanded') !== 'true';
    e.preventDefault();

    Array.prototype.forEach.call(list.querySelectorAll('.da-curr-accordion'), function (other) {
      if (other !== item) setOpen(other, false);
    });
    setOpen(item, opening);

    // closing a long card above can push this one off screen; bring its label back into view
    if (opening) {
      var top = item.getBoundingClientRect().top - 140; // room for the sticky menu and the "Module n" label
      if (top < 0) window.scrollTo({ top: window.pageYOffset + top, behavior: 'smooth' });
    }
  });
})();
