/* Bhopal course page > each module's Case Studies: the cards sit in one row that glides sideways on
   its own like a train, slowly and without stopping, and loops without an end (the cards are repeated,
   hidden from screen readers, enough times to fill the row; the row jumps back by one set when it
   reaches the copy). People can drag or swipe it with a finger, and the glide picks up again a moment
   after they let go. It pauses while the mouse is over it or a card has focus, while it is off screen
   or inside a closed module, and with reduced motion it does not glide at all. Without this script the
   row still scrolls sideways. React can re-render the page after load, so new rows are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = 32;   // pixels per second
  var IDLE = 1500;  // wait after a swipe or drag before gliding again

  function init(row) {
    var cards = [].slice.call(row.children), n = cards.length;
    if (!n) return;
    row.setAttribute('data-mg', '1');
    row.classList.add('mcs-run');
    var copies = 0;

    function addCopy() {
      cards.forEach(function (c) {
        var copy = c.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.setAttribute('inert', '');
        copy.tabIndex = -1;
        row.appendChild(copy);
      });
      copies++;
    }
    // width of one full set of cards (first card to the first card of the next set)
    function setWidth() { return row.children.length > n ? row.children[n].offsetLeft - row.children[0].offsetLeft : 0; }
    // enough copies that the row is always full while one set scrolls away
    function fill() {
      if (!row.clientWidth) return false;
      if (!copies) addCopy();
      var w = setWidth();
      if (w <= 0) return false;
      while (w * copies < row.clientWidth + 40 && copies < 8) addCopy();
      return true;
    }
    function wrap() {
      var w = setWidth();
      if (w <= 0) return;
      if (row.scrollLeft >= w) row.scrollLeft -= w;
      else if (row.scrollLeft <= 0 && touching) row.scrollLeft += w;
    }

    var visible = false, hover = false, touching = false, idleUntil = 0, last = 0, pos = 0, raf = 0;
    function nudge() { idleUntil = Date.now() + IDLE; }
    function frame(ts) {
      raf = 0;
      if (reduce || !visible || hover || touching || document.hidden || !fill()) { last = 0; return; }
      if (!last) { last = ts; pos = row.scrollLeft; }
      var dt = Math.min(64, ts - last); last = ts;
      if (Date.now() >= idleUntil) {
        pos += SPEED * dt / 1000;
        var w = setWidth();
        if (w > 0 && pos >= w) pos -= w;
        row.scrollLeft = pos;
      } else {
        pos = row.scrollLeft;
      }
      raf = requestAnimationFrame(frame);
    }
    function play() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

    row.addEventListener('scroll', function () { if (touching || Date.now() < idleUntil) wrap(); }, { passive: true });
    row.addEventListener('touchstart', function () { touching = true; nudge(); }, { passive: true });
    row.addEventListener('touchend', function () { touching = false; nudge(); play(); }, { passive: true });
    row.addEventListener('touchcancel', function () { touching = false; nudge(); play(); }, { passive: true });
    row.addEventListener('wheel', function () { nudge(); }, { passive: true });

    // mouse: drag to move, like a finger; a drag does not count as a click on a card
    var drag = null;
    row.addEventListener('mousedown', function (e) { drag = { x: e.clientX, s: row.scrollLeft, moved: false }; nudge(); });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      row.scrollLeft = drag.s - dx; wrap(); nudge();
    });
    window.addEventListener('mouseup', function () { if (drag && drag.moved) row.__dragged = true; drag = null; nudge(); });
    row.addEventListener('click', function (e) { if (row.__dragged) { e.preventDefault(); row.__dragged = false; } }, true);
    row.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // only a real mouse pauses on hover; phones fire fake mouse events after a tap
    row.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
    row.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = false; nudge(); play(); } });
    row.addEventListener('focusin', function () { hover = true; });
    row.addEventListener('focusout', function () { hover = false; play(); });
    document.addEventListener('visibilitychange', play);
    if ('IntersectionObserver' in window) {
      // a closed module has no size, so this also starts the glide when the module is opened
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) play(); }, { threshold: 0.2 }).observe(row);
    } else { visible = true; }
    play();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.mcs-grid:not([data-mg])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
