/* eBuddha Digitech - one FAQ layout for every page.
   Reads each page's own questions and answers and shows them as: heading, a sticky tab card on the left, a list of
   rounded question cards with a chevron on the right. The original FAQ is hidden (not removed) so page scripts stay intact. */
(function () {
  if (window.__ebFaq) return;
  window.__ebFaq = 1;

  var CSS = '[data-ebfq-old]{display:none!important}' +
    '.ebfq{padding:72px 0;background:#fff}' +
    '.ebfq-in{max-width:1202px;margin:0 auto;padding:0 20px}' +
    '.ebfq-h{margin:0 0 28px;font-size:clamp(28px,4vw,40px);line-height:1.2;font-weight:600;color:#0F172A;text-align:left}' +
    '.ebfq-h span{background:linear-gradient(135deg,#0a266d 0%,#1386cf 100%);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '.ebfq-grid{display:flex;gap:40px;align-items:flex-start}' +
    '.ebfq-side{flex:0 0 25%;max-width:25%;position:sticky;top:95px;display:flex;flex-direction:column;gap:8px;padding:20px;border:1px solid #DCE3F0;border-radius:14px;background:#fff}' +
    '.ebfq-tab{display:block;width:100%;padding:18px 14px;border:0;border-radius:10px;background:#fff;color:#0F172A;font-family:inherit;font-weight:500;font-size:16px;line-height:1.25;text-align:left;cursor:pointer;transition:background .25s,color .25s}' +
    '.ebfq-tab:hover{background:#F1F5FC}' +
    '.ebfq-tab.on{background:linear-gradient(135deg,#0a266d 0%,#1386cf 100%);color:#fff}' +
    '.ebfq-list{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:12px}' +
    '.ebfq-empty{padding:28px 20px;border:1px dashed #C9D4EA;border-radius:14px;color:#5B6B8C;font-size:15px;text-align:center}' +
    '.ebfq-item{border:1px solid #DCE3F0;border-radius:14px;background:#fff;overflow:hidden;transition:border-color .25s,box-shadow .25s}' +
    '.ebfq-item.open{border-color:#9DB8F0;box-shadow:0 10px 28px rgba(10,38,109,.08)}' +
    '.ebfq-q{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;padding:20px;border:0;background:transparent;color:#0F172A;font-family:inherit;font-weight:500;font-size:16px;line-height:1.45;text-align:left;cursor:pointer}' +
    '.ebfq-q svg{flex:0 0 20px;width:20px;height:20px;color:#5B6B8C;transition:transform .3s}' +
    '.ebfq-item.open .ebfq-q svg{transform:rotate(180deg)}' +
    '.ebfq-a{height:0;overflow:hidden;transition:height .3s ease}' +
    '.ebfq-ai{padding:0 20px 20px;color:#475569;font-size:15px;line-height:1.75}' +
    '.ebfq-ai p{margin:0 0 10px;color:inherit}.ebfq-ai p:last-child{margin-bottom:0}.ebfq-ai ul,.ebfq-ai ol{margin:0 0 10px;padding-left:22px}' +
    '@media (max-width:991px){.ebfq{padding:52px 0}.ebfq-grid{flex-direction:column;gap:18px}' +
    '.ebfq-side{position:static;flex:none;max-width:100%;width:100%;flex-direction:row;overflow-x:auto;padding:10px}.ebfq-tab{flex:0 0 auto;width:auto;white-space:nowrap;padding:14px 18px}}' +
    '@media (prefers-reduced-motion:reduce){.ebfq-a,.ebfq-q svg,.ebfq-tab{transition:none}}';

  // question categories, in the order they are shown
  var CATS = ['Online Certifications', 'Career Outcomes', 'Campus Immersion', 'Gen AI Specialization', 'Others'];
  var RULES = [
    [1, /\b(jobs?|placements?|placed|career|salary|salaries|ctc|packages?|hir(?:e|ing)|recruit|interviews?|resume|portfolio|intern(?:ship)?s?|freelanc\w*|earn\w*|income|outcomes?)\b/i],
    [2, /\b(campus|offline|classroom|in-person|on-site|onsite|bhopal|hostel|immersion|visit|address|location|centre|center)\b/i],
    [0, /\b(online|certificat\w*|live (?:class|session)s?|recorded|remote|zoom|from home|virtual)\b/i],
    [3, /(\bgen ?ai\b|generative|\bai\b|artificial intelligence|chatgpt|prompt|machine learning|automation|agents?)/i]
  ];
  function category(q) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(q)) return RULES[i][0];
    return 4;
  }

  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function prevHeading(el) {
    var p = el.previousElementSibling;
    while (p && !/^H[1-6]$/.test(p.tagName)) p = p.previousElementSibling;
    return p;
  }

  // Every page ends with the same block: questions, then the enquiry form, right before the footer.
  var IQ_HEAD = "<section id=\"ebuddha-enquiry\" class=\"py-lg-80 py-64 wsc-iq-sec\"><style>.wsc-iq-sec{background:#F7F9FC}.wsc-iq-card{background:#fff;border:1px solid #E8ECF3;border-radius:18px;padding:26px}.wsc-iq-form .fld{margin-bottom:16px}.wsc-iq-form label{display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px}.wsc-iq-form input,.wsc-iq-form select,.wsc-iq-form textarea{width:100%;border:1px solid #DDE3ED;border-radius:10px;padding:11px 14px;font-size:14px;color:#0F172A;background:#fff;outline:none;font-family:inherit;transition:border-color .2s,box-shadow .2s}.wsc-iq-form input:focus,.wsc-iq-form select:focus,.wsc-iq-form textarea:focus{border-color:#194CFF;box-shadow:0 0 0 3px rgba(25,76,255,.12)}.wsc-iq-form textarea{min-height:96px;resize:vertical}.wsc-iq-btn{width:100%;background:#194CFF;color:#fff;border:0;border-radius:10px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;transition:background .2s}.wsc-iq-btn:hover{background:#1340D8}#ebuddha-enquiry .row>.col-lg-5{max-width:100%!important}.wsc-iq-form{display:grid;grid-template-columns:1fr 1fr;column-gap:20px}.wsc-iq-form .fld:nth-child(5),.wsc-iq-form .wsc-iq-btn,.wsc-iq-form .wsc-iq-ok{grid-column:1/-1}@media (max-width:575px){.wsc-iq-form{grid-template-columns:1fr}}.wsc-iq-ok{display:none;margin-top:14px;background:#ECFDF3;border:1px solid #ABEFC6;color:#067647;font-size:13px;line-height:20px;padding:10px 12px;border-radius:10px}.wsc-faq-item{background:#fff;border:1px solid #E8ECF3;border-radius:14px;margin-bottom:12px;overflow:hidden}.wsc-faq-item summary{list-style:none;cursor:pointer;padding:16px 20px;font-size:15px;font-weight:600;color:#0F172A;display:flex;align-items:center;justify-content:space-between;gap:16px}.wsc-faq-item summary::-webkit-details-marker{display:none}.wsc-faq-item summary::after{content:\"+\";font-size:22px;font-weight:400;color:#194CFF;flex:0 0 auto;line-height:1}.wsc-faq-item[open] summary::after{content:\"–\"}.wsc-faq-item .ans{padding:0 20px 18px;font-size:14px;line-height:22px;color:#475569;margin:0}</style><div class=\"container-main container-w-xl-1202\"><div class=\"text-center mb-40\"><h2 class=\"fs-lg-32 fs-24 lh-lg-48 lh-36 fw-lg-600 fw-700 text-color-1 mb-16\">Have a Question?</h2><p class=\"fs-14 lh-21 fw-400 text-color-7 mb-0\">Send us your details and our team will get back to you, or browse the common questions above.</p></div><div class=\"row\"><div class=\"col-lg-5 mb-4 mb-lg-0\"><div class=\"wsc-iq-card\"><form class=\"wsc-iq-form\"><div class=\"fld\"><label for=\"wsc-iq-name\">Full Name</label><input id=\"wsc-iq-name\" required=\"\" placeholder=\"Your name\" type=\"text\" name=\"name\"></div><div class=\"fld\"><label for=\"wsc-iq-phone\">Phone</label><input id=\"wsc-iq-phone\" placeholder=\"Optional\" type=\"tel\" name=\"phone\"></div><div class=\"fld\"><label for=\"wsc-iq-email\">Email</label><input id=\"wsc-iq-email\" required=\"\" placeholder=\"you@example.com\" type=\"email\" name=\"email\"></div><div class=\"fld\"><label for=\"wsc-iq-topic\">Interested in</label><select id=\"wsc-iq-topic\" name=\"topic\"><option value=\"\" disabled=\"\" selected=\"\">Select an option</option><option value=\"Digital Marketing\">Digital Marketing</option><option value=\"Web Development\">Web Development</option><option value=\"AI Courses\">AI Courses</option><option value=\"Digital Marketing Services\">Digital Marketing Services</option><option value=\"Performance Marketing Services\">Performance Marketing Services</option><option value=\"Web Development Services\">Web Development Services</option><option value=\"Something else\">Something else</option></select></div><div class=\"fld\"><label for=\"wsc-iq-msg\">Message</label><textarea id=\"wsc-iq-msg\" name=\"message\" placeholder=\"Tell us what you would like to know\"></textarea></div><button type=\"submit\" class=\"wsc-iq-btn\">Send Enquiry</button><div id=\"wsc-iq-ok\" class=\"wsc-iq-ok\" role=\"status\">Thanks! Your enquiry has been noted and our team will get back to you.</div></form></div></div>";
  var IQ_ITEMS = "<div class=\"col-lg-7\"><details class=\"wsc-faq-item\"><summary>How can I get more details about a program?</summary><p class=\"ans\">Share your details in the form and our team will send you the full curriculum, schedule and fee structure.</p></details><details class=\"wsc-faq-item\"><summary>What happens after I submit the form?</summary><p class=\"ans\">Your enquiry reaches our counselling team, who get in touch over email or phone to answer your questions.</p></details><details class=\"wsc-faq-item\"><summary>Can I request a callback at a specific time?</summary><p class=\"ans\">Yes. Add your phone number and mention a preferred time in the message box, and we will try to match it.</p></details><details class=\"wsc-faq-item\"><summary>I am not sure which program suits me. Can you help?</summary><p class=\"ans\">Tell us about your background and what you want to work towards, and we will suggest the closest fit.</p></details><details class=\"wsc-faq-item\"><summary>How do I reach you for anything else?</summary><p class=\"ans\">Use this form for programme enquiries, or the contact links in the footer for everything else.</p></details></div>";
  var IQ_TAIL = "</div></div></section>";
  var IQ_WA = 'https://wa.me/918461958162?text=';

  function hasOwnFaq() {
    return !!document.querySelector('.wp-block-yoast-faq-block, .schema-faq, .offline-faq-border-box .accordion-item, section.eb-faq .eb-acc details, #rf-faq details.rf-fq, [data-own-faq]');
  }

  // pages without the main site stylesheet (blog, resources) still get a properly spaced block
  function iqFallbacks(sec) {
    if (!sec) return;
    var cs = function (e, p) { return window.getComputedStyle(e)[p]; };
    var ct = sec.querySelector('.container-main');
    if (ct && cs(ct, 'maxWidth') === 'none') { ct.style.maxWidth = '1202px'; ct.style.margin = '0 auto'; ct.style.padding = '0 20px'; }
    if (cs(sec, 'paddingTop') === '0px') sec.style.padding = '72px 0';
    var hd = sec.querySelector('.text-center');
    if (hd && cs(hd, 'textAlign') !== 'center') {
      hd.style.textAlign = 'center'; hd.style.marginBottom = '40px';
      var h = hd.querySelector('h2'), p = hd.querySelector('p');
      if (h) h.style.cssText += ';font-size:32px;line-height:1.5;font-weight:600;color:#0F172A;margin:0 0 16px';
      if (p) p.style.cssText += ';font-size:14px;line-height:21px;color:#475569;margin:0';
    }
    var row = sec.querySelector('.row');
    if (row && cs(row, 'display') !== 'flex') { row.style.display = 'flex'; row.style.flexWrap = 'wrap'; }
    var col = sec.querySelector('.col-12');
    if (col) { col.style.flex = '0 0 100%'; col.style.maxWidth = '100%'; }
  }

  function ensureEnquiry() {
    if (document.querySelector('[data-iq-added]')) return;
    var cur = document.getElementById('ebuddha-enquiry');
    if (cur) {
      var fm = cur.querySelector('.wsc-iq-form');
      if (fm && window.getComputedStyle(fm).display === 'grid') return; // already the two-column form (home, events)
      // older single-column enquiry (about, hire-from-us): replace it with the new block
      cur.setAttribute('data-ebfq-old', '1');
      cur.removeAttribute('id');
      [].forEach.call(cur.querySelectorAll('details.wsc-faq-item'), function (d) { d.className = ''; });
    }
    var foot = [].filter.call(document.querySelectorAll('footer'), function (x) { return x.offsetHeight > 0; })[0] || document.querySelector('footer');
    if (!foot || !foot.parentNode) return;
    var own = hasOwnFaq();
    var wrap = document.createElement('div');
    wrap.setAttribute('data-iq-added', '1');
    var head = own ? IQ_HEAD.replace('col-lg-5 mb-4 mb-lg-0', 'col-12') : IQ_HEAD;
    wrap.innerHTML = '<div data-faq-after="1" aria-hidden="true"></div>' + head + (own ? '' : IQ_ITEMS) + IQ_TAIL;
    foot.parentNode.insertBefore(wrap, foot);
    iqFallbacks(wrap.querySelector('section'));
    var f = wrap.querySelector('.wsc-iq-form');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(f), NL = String.fromCharCode(10);
      var t = 'Hi eBuddha Digitech, I have a question.' + NL + 'Name: ' + (d.get('name') || '') + NL + 'Email: ' + (d.get('email') || '') + NL +
        'Phone: ' + (d.get('phone') || '-') + NL + 'Interested in: ' + (d.get('topic') || '-') + NL + 'Message: ' + (d.get('message') || '-');
      window.open(IQ_WA + encodeURIComponent(t), '_blank', 'noopener');
      var ok = wrap.querySelector('.wsc-iq-ok');
      if (ok) ok.style.display = 'block';
      f.reset();
    });
  }

  function find() {
    var i, els, items;
    // blog posts (Yoast FAQ block)
    var y = document.querySelector('.wp-block-yoast-faq-block, .schema-faq');
    if (y) {
      els = y.querySelectorAll('.schema-faq-section');
      items = [].map.call(els, function (s) { return { q: txt(s.querySelector('.schema-faq-question')), a: (s.querySelector('.schema-faq-answer') || {}).innerHTML || '' }; });
      var h = prevHeading(y);
      if (items.length) return { old: [y, h], before: y, items: items, id: h && h.id };
    }
    // home, about, contact, hire-from-us: questions beside the enquiry form
    var w = document.querySelectorAll('details.wsc-faq-item');
    if (w.length) {
      var col = w[0].parentNode;
      items = [].map.call(w, function (d) { return { q: txt(d.querySelector('summary')), a: '<p>' + ((d.querySelector('.ans') || {}).innerHTML || '') + '</p>' }; });
      var sec = document.getElementById('ebuddha-enquiry');
      var ch = document.querySelector('.eb-ch-sec');
      var ref = sec;
      if (ch && (!sec || (sec.compareDocumentPosition(ch) & 4))) ref = ch; // whichever comes last on the page
      var mc = ch && document.querySelector('section.master-classes-section');
      if (mc) ref = mc; // home: FAQ sits right after Free Masterclasses
      var fa = document.querySelector('[data-faq-after]');
      if (fa) ref = fa; // a page can name its own spot, e.g. /events
      return { old: [col], after: ref, items: items, widen: col, id: '' };
    }
    // course pages (accordion)
    var box = document.querySelector('.offline-faq-border-box');
    if (box && box.querySelector('.accordion-item')) {
      els = box.querySelectorAll('.accordion-item');
      items = [].map.call(els, function (it) { return { q: txt(it.querySelector('h3')), a: (it.querySelector('.accordion-body') || {}).innerHTML || '' }; });
      var s = box.closest('section');
      var wrap = s;
      var p = s && s.parentNode;
      if (p && p.id && /^section-/.test(p.id)) wrap = p;
      var hh = s && s.querySelector('h2');
      if (wrap) return { old: [wrap], before: wrap, items: items, id: wrap.id || (hh && hh.id) || '' };
    }
    // services
    var sv = document.querySelector('section.eb-faq');
    if (sv) {
      els = sv.querySelectorAll('.eb-acc details');
      items = [].map.call(els, function (d) { var q = d.querySelector('summary'); return { q: txt(q), a: (d.querySelector('.eb-acc-body') || {}).innerHTML || '' }; });
      if (items.length) return { old: [sv], before: sv, items: items, id: sv.id || '' };
    }
    // refer and earn
    var rf = document.getElementById('rf-faq');
    if (rf) {
      els = rf.querySelectorAll('details.rf-fq');
      items = [].map.call(els, function (d) { return { q: txt(d.querySelector('summary span')), a: (d.querySelector('.rf-fa') || {}).innerHTML || '' }; });
      if (items.length) return { old: [rf], before: rf, items: items, id: 'rf-faq' };
    }
    return null;
  }

  function build(info) {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var sec = document.createElement('section');
    sec.className = 'ebfq';
    sec.setAttribute('data-ebfq', '1');
    var chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    var list = '';
    info.items.forEach(function (it, n) {
      if (!it.q) return;
      list += '<div class="ebfq-item" data-c="' + category(it.q) + '"><button type="button" class="ebfq-q" aria-expanded="false"><span></span>' + chev + '</button><div class="ebfq-a" role="region"><div class="ebfq-ai">' + it.a + '</div></div></div>';
    });
    sec.innerHTML = '<div class="ebfq-in"><h2 class="ebfq-h">Frequently Asked <span>Questions</span></h2><div class="ebfq-grid"><aside class="ebfq-side"><button type="button" class="ebfq-tab on" data-c="">All Questions</button>' + CATS.map(function (c, i) { return '<button type="button" class="ebfq-tab" data-c="' + i + '">' + c + '</button>'; }).join('') + '</aside><div class="ebfq-list">' + list + '<div class="ebfq-empty" hidden>No questions in this category yet. Choose All Questions to see everything.</div></div></div></div>';
    var qs = sec.querySelectorAll('.ebfq-q span'), k = 0;
    info.items.forEach(function (it) { if (it.q) { qs[k++].textContent = it.q.replace(/^\s*\d+\s*[.)]\s*/, ''); } });
    var rows = sec.querySelectorAll('.ebfq-item');
    var tabs = sec.querySelectorAll('.ebfq-tab'), empty = sec.querySelector('.ebfq-empty');
    [].forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        var c = tab.getAttribute('data-c'), shown = 0;
        [].forEach.call(tabs, function (t) { t.classList.toggle('on', t === tab); });
        [].forEach.call(rows, function (r) {
          var show = c === '' || r.getAttribute('data-c') === c;
          if (!show && r.classList.contains('open')) setOpen(r, false);
          r.style.display = show ? '' : 'none';
          if (show) shown++;
        });
        empty.hidden = shown > 0;
      });
    });
    function setOpen(item, open) {
      var a = item.querySelector('.ebfq-a');
      item.classList.toggle('open', open);
      item.querySelector('.ebfq-q').setAttribute('aria-expanded', open ? 'true' : 'false');
      a.style.height = open ? a.firstChild.offsetHeight + 'px' : '0px';
    }
    [].forEach.call(rows, function (item) {
      item.querySelector('.ebfq-q').addEventListener('click', function () {
        var open = !item.classList.contains('open');
        [].forEach.call(rows, function (o) { if (o !== item && o.classList.contains('open')) setOpen(o, false); });
        setOpen(item, open);
      });
    });
    window.addEventListener('resize', function () { [].forEach.call(rows, function (o) { if (o.classList.contains('open')) o.querySelector('.ebfq-a').style.height = o.querySelector('.ebfq-ai').offsetHeight + 'px'; }); });
    return sec;
  }

  function run() {
    if (document.querySelector('[data-ebfq]')) return true;
    ensureEnquiry();
    var info = find();
    if (!info || !info.items.length) return false;
    var sec = build(info);
    info.old.forEach(function (o) {
      if (!o) return;
      o.setAttribute('data-ebfq-old', '1');
      if (o.id) o.removeAttribute('id');
    });
    if (info.id) sec.id = info.id;
    if (info.widen) {
      // the enquiry form was in a narrow left column next to the questions: centre it now
      var row = info.widen.parentNode;
      var left = row && row.firstElementChild;
      if (row && left) {
        row.style.justifyContent = 'center';
        left.style.flex = '0 0 100%';
        left.style.maxWidth = '640px';
      }
    }
    var iq = document.querySelector('[data-iq-added] [data-faq-after]');
    if (iq && info.before) { info.after = iq; info.before = null; } // the page's own questions move to sit right above the enquiry form
    if (info.before) info.before.parentNode.insertBefore(sec, info.before);
    else if (info.after) info.after.parentNode.insertBefore(sec, info.after.nextSibling);
    return true;
  }

  function isHydrated() {
    // Next pages carry their page data inline; plain static pages (blog, services, legal, refer) do not
    return [].some.call(document.scripts, function (s) { return !s.src && /__next_f\.push/.test(s.textContent || ''); });
  }

  function start() {
    if (!isHydrated()) { run(); return; }
    // Next pages: wait until the page has finished hydrating, then try a few times
    var n = 0;
    (function tick() {
      n++;
      if (run() || n > 8) return;
      setTimeout(tick, 700);
    })();
  }

  if (document.readyState === 'complete') {
    setTimeout(start, isHydrated() ? 900 : 0);
  } else if (isHydrated()) {
    window.addEventListener('load', function () { setTimeout(start, 900); });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
