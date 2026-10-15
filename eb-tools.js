/* Bhopal course page > Hands-On Training with Digital Marketing Tools (toolkit): the category
   chips filter the tools, and on phones the 3 x 3 pages of tiles get dots that follow the swipe
   (tap a dot to jump to that page). On wider screens only the first rows show until "Show all" is
   pressed. Without this script every tool is listed in a plain grid.
   React can re-render the page after load, so new copies of the section are set up too. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PER = 9; // tiles per page on phones
  var LIMIT = 24; // tiles shown on wider screens before "Show all"
  var mq = window.matchMedia ? window.matchMedia('(max-width: 767px)') : { matches: false };

  function init(sec) {
    var grid = sec.querySelector('.tk-grid'), dots = sec.querySelector('.tk-dots'), showing = sec.querySelector('.tk-showing b');
    var chips = [].slice.call(sec.querySelectorAll('.tk-chip'));
    var more = sec.querySelector('.tk-more'), open = false;
    if (!grid || !dots) return;
    sec.setAttribute('data-tk', '1');
    sec.classList.add('tk-js');
    var tiles = [].slice.call(grid.children);

    function pages() { return Math.max(1, Math.ceil(grid.children.length / PER)); }
    // distance from one page to the next (page width plus the gap between columns)
    function step() { var c = grid.children; return c.length > PER ? c[PER].offsetLeft - c[0].offsetLeft : grid.clientWidth; }
    function page() { var s = step(); return s ? Math.round(grid.scrollLeft / s) : 0; }
    function buildDots() {
      dots.innerHTML = '';
      var n = pages();
      if (n < 2) return;
      for (var i = 0; i < n; i++) (function (i) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'tk-dot';
        d.setAttribute('aria-label', 'Show page ' + (i + 1) + ' of ' + n);
        d.addEventListener('click', function () { grid.scrollTo({ left: i * step(), behavior: reduce ? 'auto' : 'smooth' }); });
        dots.appendChild(d);
      })(i);
      sync();
    }
    function sync() {
      var k = page();
      [].forEach.call(dots.children, function (d, i) { d.setAttribute('aria-current', i === k ? 'true' : 'false'); });
    }

    // On phones the grid fills column by column (3 rows per page), so each page is
    // re-ordered to read left to right, row by row. Elsewhere the order is left as it is.
    var current = tiles;
    function place() {
      var out = [], one = current.length <= PER;
      grid.classList.toggle('tk-one', one); // a single page: a plain 3-column grid
      for (var p = 0; p < current.length; p += PER) {
        var chunk = current.slice(p, p + PER);
        var cols = Math.ceil(chunk.length / 3);
        // only when the page fills whole columns (3, 6 or 9 tiles); a ragged page keeps its order
        if (mq.matches && !one && chunk.length % 3 === 0) for (var c = 0; c < cols; c++) for (var r = 0; r < 3; r++) out.push(chunk[r * cols + c]);
        else out = out.concat(chunk);
      }
      grid.innerHTML = '';
      out.forEach(function (t, i) { t.style.setProperty('--k', i % PER); grid.appendChild(t); });
      cut();
    }

    // wider screens: hide the tiles past LIMIT until the visitor asks for all of them
    function cut() {
      var long = !mq.matches && current.length > LIMIT;
      [].forEach.call(grid.children, function (t, i) { t.classList.toggle('tk-cut', long && !open && i >= LIMIT); });
      if (!more) return;
      more.hidden = !long;
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      more.textContent = open ? 'Show fewer tools' : 'Show all ' + current.length + ' tools';
    }
    if (more) more.addEventListener('click', function () {
      open = !open;
      cut();
      if (!open) sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });

    function filter(cat) {
      chips.forEach(function (c) {
        var on = c.getAttribute('data-cat') === cat;
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && c.parentNode.parentNode.scrollWidth > c.parentNode.parentNode.clientWidth) {
          var row = c.parentNode.parentNode, li = c.parentNode;
          row.scrollTo({ left: li.offsetLeft - row.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
        }
      });
      // matching tiles are put back in order and the rest taken out, so the 3 x 3 pages stay full
      var shown = tiles.filter(function (t) { return cat === 'all' || t.getAttribute('data-cat') === cat; });
      current = shown;
      open = false;
      place();
      if (showing) showing.textContent = shown.length;
      grid.scrollLeft = 0;
      buildDots();
    }

    chips.forEach(function (c) { c.addEventListener('click', function () { filter(c.getAttribute('data-cat')); }); });
    grid.addEventListener('scroll', function () { sync(); }, { passive: true });
    window.addEventListener('resize', function () { buildDots(); });
    if (mq.addEventListener) mq.addEventListener('change', function () { place(); grid.scrollLeft = 0; buildDots(); });
    place();
    buildDots();
  }

  function run() {
    [].forEach.call(document.querySelectorAll('.tk:not([data-tk])'), init);
  }
  function start() {
    run();
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
