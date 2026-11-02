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
  var CATS = ['Online Certifications', 'Career Outcomes', 'Campus Immersion', 'GenAI Specialization', 'Others'];
  var RULES = [
    [1, /\b(jobs?|placements?|placed|career|salary|salaries|ctc|packages?|hir(?:e|ing)|recruit|interviews?|resume|portfolio|intern(?:ship)?s?|freelanc\w*|earn\w*|income|outcomes?)\b/i],
    [2, /\b(campus|offline|classroom|in-person|on-site|onsite|bhopal|hostel|immersion|visit|address|location|center|center)\b/i],
    [0, /\b(online|certificat\w*|live (?:class|session)s?|recorded|remote|zoom|from home|virtual)\b/i],
    [3, /(\bgen ?ai\b|generative|\bai\b|artificial intelligence|chatgpt|prompt|machine learning|automation|agents?)/i]
  ];
  function category(q) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(q)) return RULES[i][0];
    return 4;
  }

  // ---- per-page questions and category names, from /faq-data/<page>.json ------------------------------------------
  // A page's file lists its own category names, the existing questions to keep ({start of question: category}) and
  // new questions written for what people search and ask. Pages without a file keep the wording-based categories.
  var FD;
  function dataKey() {
    var p = location.pathname.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\/+$/, '');
    return p === '' ? 'home' : p.slice(1).replace(/\//g, '__');
  }
  function loadData(done) {
    if (FD !== undefined) { done(); return; }
    var x = new XMLHttpRequest();
    x.open('GET', '/faq-data/' + dataKey() + '.json');
    x.onload = function () { try { FD = x.status === 200 ? JSON.parse(x.responseText) : null; } catch (e) { FD = null; } done(); };
    x.onerror = function () { FD = null; done(); };
    x.send();
  }
  function nq(s) {
    return (s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/^\s*\d+\s*[.)]\s*/, '').replace(/\s+/g, ' ').trim();
  }
  function applyData(info) {
    var keep = FD.keep || {}, keys = Object.keys(keep), out = [];
    info.items.forEach(function (it) {
      var q = nq(it.q), hit = null;
      for (var i = 0; i < keys.length; i++) if (q.indexOf(nq(keys[i])) === 0) { hit = keys[i]; break; }
      if (hit !== null) out.push({ q: it.q, a: it.a, ci: keep[hit] });
    });
    FD.items.forEach(function (x) { out.push({ q: x.q, a: x.a, ci: x.c }); });
    out.forEach(function (o, i) { o.n = i; });
    out.sort(function (a, b) { return a.ci - b.ci || a.n - b.n; });
    info.items = out;
    info.cats = FD.cats;
    return info;
  }

  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function prevHeading(el) {
    var p = el.previousElementSibling;
    while (p && !/^H[1-6]$/.test(p.tagName)) p = p.previousElementSibling;
    return p;
  }

  // "Interested in" choices: every course and service named on the site, in two groups
  var TOPIC_COURSES = ['Digital Marketing Course in Bhopal', 'Online Digital Marketing Course', 'Full Stack Development with AI Engineering'];
  var TOPIC_SERVICES = ['Digital Marketing Services', 'SEO Services', 'Social Media Marketing Services', 'Performance Marketing Services', 'Website Design & Development Services'];
  function topicEsc(s) { return s.replace(/&/g, '&amp;'); }
  var TOPIC_GROUPS = '<optgroup label="Courses">' + TOPIC_COURSES.map(function (c) { return '<option value="' + topicEsc(c) + '">' + topicEsc(c) + '</option>'; }).join('') + '</optgroup>' +
    '<optgroup label="Services">' + TOPIC_SERVICES.map(function (c) { return '<option value="' + topicEsc(c) + '">' + topicEsc(c) + '</option>'; }).join('') + '</optgroup>' +
    '<optgroup label="Others"><option value="Hiring from eBuddha Digitech">Hiring Candidates</option><option value="Something else">Something else</option></optgroup>';
  // ---- look of the enquiry form (ebform-look) -------------------------------------------------------------------------
  function formIcon(paths, color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  var FORM_ICONS = {
    name: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    city: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    topic: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'
  };
  function FORM_CSS() {
    var q = '.wsc-iq-form ', css = '.wsc-iq-form .eb-full{grid-column:1/-1}' +
      q + '.fld:has(:required)>label:after{content:" *";color:#DC2626}' +
      '.wsc-iq-card{position:relative;padding:34px 32px 28px;border:1px solid #E3EAF6;border-radius:20px;background:#fff;box-shadow:0 24px 56px -28px rgba(25,76,255,.28),0 2px 6px rgba(15,23,42,.04)}' +
      '.eb-modal-form{grid-template-columns:1fr!important}' +
      q + '.fld{margin-bottom:18px}' +
      q + 'label{margin-bottom:7px;font-size:13px;line-height:18px;font-weight:600;color:#1E293B}' +
      q + 'input,' + q + 'textarea{border:1px solid #D9E1EE;border-radius:12px;background-color:#fff;font-size:14.5px;line-height:22px;padding:12px 14px;transition:border-color .2s,box-shadow .2s,background-color .2s}' +
      q + 'input::placeholder,' + q + 'textarea::placeholder{color:#94A3B8}' +
      q + 'input:hover,' + q + 'textarea:hover{border-color:#B7C6E6}' +
      q + 'input:focus,' + q + 'textarea:focus{border-color:#194CFF;box-shadow:0 0 0 4px rgba(25,76,255,.12)}' +
      q + 'textarea{min-height:112px}' +
      q + 'input:required:not(:placeholder-shown):invalid{border-color:#F87171;background-color:#FFF8F8}' +
      q + 'input:required:not(:placeholder-shown):valid{border-color:#7CD1A0}' +
      q + '.ebsel-btn{min-height:48px;padding:12px 14px 12px 44px;border-color:#D9E1EE;border-radius:12px;font-size:14.5px}' +
      q + '.ebsel-pop{border-radius:16px}';
    [['name', 'name'], ['phone', 'phone'], ['email', 'email'], ['city', 'city']].forEach(function (p) {
      var sel = q + 'input[name="' + p[0] + '"]';
      css += sel + '{padding-left:44px;background-repeat:no-repeat;background-position:14px 50%;background-size:18px;background-image:' + formIcon(FORM_ICONS[p[1]], '#8A99B5') + '}' +
        sel + ':focus{background-image:' + formIcon(FORM_ICONS[p[1]], '#194CFF') + '}';
    });
    // the blog's own modal styles use very specific selectors, so the same look is forced inside its pop-up forms
    css += '.eb-modal-form .fld input{border:1px solid #D9E1EE!important;border-radius:12px!important;padding:12px 14px 12px 44px!important;background-color:#fff!important;font-size:14.5px!important;height:auto!important}' +
      '.eb-modal-form .fld input:hover{border-color:#B7C6E6!important}' +
      '.eb-modal-form .fld input:focus{border-color:#194CFF!important;box-shadow:0 0 0 4px rgba(25,76,255,.12)!important;outline:0!important}' +
      '.eb-modal-form .fld input:required:not(:placeholder-shown):invalid{border-color:#F87171!important;background-color:#FFF8F8!important}';
    css += q + '.ebsel-btn{background-repeat:no-repeat;background-position:14px 50%;background-size:18px;background-image:' + formIcon(FORM_ICONS.topic, '#8A99B5') + '}' +
      q + '.ebsel.open .ebsel-btn,' + q + '.ebsel-btn:focus-visible{background-image:' + formIcon(FORM_ICONS.topic, '#194CFF') + '}' +
      q + '.wsc-iq-btn{display:flex;align-items:center;justify-content:center;gap:10px;height:54px;padding:0 20px;border-radius:12px;background:linear-gradient(135deg,#194CFF,#2F6BFF);font-size:16px;font-weight:600;box-shadow:0 14px 28px -10px rgba(25,76,255,.55);transition:transform .18s,box-shadow .18s,filter .18s}' +
      q + '.wsc-iq-btn:hover{background:linear-gradient(135deg,#194CFF,#2F6BFF);filter:brightness(1.06);transform:translateY(-2px);box-shadow:0 18px 32px -10px rgba(25,76,255,.6)}' +
      q + '.wsc-iq-btn svg{width:18px;height:18px}' +
      q + '.eb-note{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:8px;margin:14px 0 0;font-size:12.5px;line-height:18px;color:#64748B;text-align:center}' +
      q + '.eb-note svg{flex:0 0 auto;width:15px;height:15px;color:#16A34A}' +
      '@media (max-width:575px){.wsc-iq-card{padding:28px 18px 22px}}';
    return css;
  }

  // ---- enquiry form fields: phone is required, email asks for Gmail, and there is a City box ------------------------
  function upgradeForms() {
    if (!document.getElementById('ebform-css')) {
      var st = document.createElement('style'); st.id = 'ebform-css';
      st.textContent = FORM_CSS();
      document.head.appendChild(st);
    }
        var nForm = 0;
    // blog modal forms (Bootstrap markup) are converted to the same field layout first
    [].forEach.call(document.querySelectorAll('form[data-wa]:not(.wsc-iq-form)'), function (m) {
      m.classList.add('wsc-iq-form', 'eb-modal-form');
      m.removeAttribute('novalidate');
      [].forEach.call(m.querySelectorAll('.mb-3'), function (b) { b.classList.remove('mb-3'); b.classList.add('fld'); });
      [].forEach.call(m.querySelectorAll('input,select,textarea'), function (x) { x.classList.remove('form-control', 'form-select'); });
      [].forEach.call(m.querySelectorAll('label'), function (l) { l.classList.remove('form-label'); var i = l.parentNode.querySelector('input,select,textarea'); if (i && i.name === 'name') l.textContent = 'Full Name'; if (i && i.name === 'phone') l.textContent = 'Phone'; });
      var b = m.querySelector('button[type="submit"]'); if (b) { b.className = 'wsc-iq-btn'; }
    });
    [].forEach.call(document.querySelectorAll('.wsc-iq-form'), function (f) {
      if (f.getAttribute('data-ebu') || f.closest('[data-ebfq-old]')) return;
      f.setAttribute('data-ebu', '1');
      var ph = f.querySelector('input[name="phone"]'), em = f.querySelector('input[name="email"]');
      var lab = function (el, txt) { var l = el && (el.id && f.querySelector('label[for="' + el.id + '"]') || (el.closest('.fld') || {}).firstElementChild); if (l && l.tagName === 'LABEL' && txt) l.textContent = txt; };
      if (ph) {
        ph.required = true; ph.placeholder = '10-digit mobile number';
        ph.setAttribute('inputmode', 'tel'); ph.setAttribute('autocomplete', 'tel');
        ph.setAttribute('pattern', '[+]?[0-9][0-9 \\-]{8,16}[0-9]'); ph.title = 'Enter a valid phone number, for example 98765 43210';
      }
      if (em) {
        em.required = true; em.placeholder = 'yourname@gmail.com'; em.setAttribute('autocomplete', 'email');
        lab(em, 'Gmail');
      }
      var anchor = em && em.closest('.fld');
      if (anchor && !f.querySelector('input[name="city"]')) {
        var d = document.createElement('div');
        d.className = 'fld';
        var cid = 'wsc-iq-city' + (nForm++ ? '-' + nForm : '');
        d.innerHTML = '<label for="' + cid + '">City</label><input id="' + cid + '" name="city" type="text" required placeholder="Your city, e.g. Bhopal" autocomplete="address-level2">';
        anchor.insertAdjacentElement('afterend', d);
      }
      var bt = f.querySelector('.wsc-iq-btn');
      if (bt && !bt.querySelector('svg')) bt.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/></svg>');
      if (bt && !f.querySelector('.eb-note')) bt.insertAdjacentHTML('afterend', '<p class="eb-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Your details open in WhatsApp, ready to send. We use them only to reply to your enquiry.</p>');
      var tp = f.querySelector('select[name="topic"]'), ms = f.querySelector('textarea');
      [tp, ms].forEach(function (x) { var w = x && x.closest('.fld'); if (w) w.classList.add('eb-full'); });
    });
  }

  // ---- grouped dropdown that replaces the plain browser list --------------------------------------------------------
  var SEL_CSS = '.ebsel{position:relative}' +
    '.ebsel-native{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden}' +
    '.ebsel-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:11px 14px;border:1px solid #DDE3ED;border-radius:10px;background:#fff;color:#0F172A;font-family:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer;transition:border-color .2s,box-shadow .2s}' +
    '.ebsel-btn:hover{border-color:#B9C7E6}' +
    '.ebsel-btn:focus-visible,.ebsel.open .ebsel-btn{outline:0;border-color:#194CFF;box-shadow:0 0 0 3px rgba(25,76,255,.12)}' +
    '.ebsel-val{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ebsel-val.ph{color:#94A3B8}' +
    '.ebsel-chev{flex:0 0 auto;width:18px;height:18px;color:#64748B;transition:transform .2s}' +
    '.ebsel.open .ebsel-chev{transform:rotate(180deg);color:#194CFF}' +
    '.ebsel-pop{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:60;max-height:340px;overflow:auto;padding:8px;border:1px solid #DCE6FA;border-radius:14px;background:#fff;box-shadow:0 18px 44px rgba(15,23,42,.16);opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity .15s,transform .15s,visibility .15s}' +
    '.ebsel.open .ebsel-pop{opacity:1;visibility:visible;transform:none}' +
    '.ebsel.up .ebsel-pop{top:auto;bottom:calc(100% + 6px);transform:translateY(4px)}' +
    '.ebsel.up.open .ebsel-pop{transform:none}' +
    '.ebsel-gh{display:flex;align-items:center;gap:8px;padding:10px 10px 6px;font-size:11.5px;line-height:16px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#64748B}' +
    '.ebsel-gh:not(:first-child){margin-top:4px;border-top:1px solid #EDF1F8;padding-top:14px}' +
    '.ebsel-gh svg{width:15px;height:15px;color:#194CFF}' +
    '.ebsel-op{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:10px;background:transparent;color:#0F172A;font-family:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer}' +
    '.ebsel-op:hover,.ebsel-op.act{background:#F1F5FC}' +
    '.ebsel-op.on{background:#EEF3FF;color:#194CFF;font-weight:600}' +
    '.ebsel-op span{flex:1 1 auto;min-width:0}' +
    '.ebsel-op i{flex:0 0 auto;display:none;width:18px;height:18px;color:#194CFF}' +
    '.ebsel-op.on i{display:block}' +
    '.ebsel-op:focus{outline:0}' +
    '@media (max-width:575px){.ebsel-pop{max-height:min(320px,55vh)}}' +
    '@media (prefers-reduced-motion:reduce){.ebsel-pop,.ebsel-chev{transition:none}}';
  var ICON = {
    chev: '<svg class="ebsel-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    tick: '<i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></i>',
    Courses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>',
    Services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
    Others: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>'
  };
  function enhanceSelect(sel) {
    if (!document.getElementById('ebsel-css')) {
      var st = document.createElement('style'); st.id = 'ebsel-css'; st.textContent = SEL_CSS; document.head.appendChild(st);
    }
    var wrap = document.createElement('div');
    wrap.className = 'ebsel';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ebsel-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    var lab = sel.id && document.querySelector('label[for="' + sel.id + '"]');
    if (lab) { if (!lab.id) lab.id = sel.id + '-lbl'; btn.setAttribute('aria-labelledby', lab.id); }
    var val = document.createElement('span'); val.className = 'ebsel-val';
    btn.appendChild(val); btn.insertAdjacentHTML('beforeend', ICON.chev);
    var pop = document.createElement('div');
    pop.className = 'ebsel-pop'; pop.setAttribute('role', 'listbox');
    var ops = [];
    function addOp(o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ebsel-op'; b.setAttribute('role', 'option');
      b.setAttribute('data-v', o.value);
      b.innerHTML = '<span></span>' + ICON.tick;
      b.firstChild.textContent = o.textContent;
      pop.appendChild(b); ops.push(b);
    }
    [].forEach.call(sel.children, function (c) {
      if (c.tagName === 'OPTGROUP') {
        var g = document.createElement('div');
        g.className = 'ebsel-gh'; g.setAttribute('role', 'presentation');
        g.innerHTML = (ICON[c.label] || '') + '<b></b>';
        g.lastChild.textContent = c.label; g.lastChild.style.font = 'inherit';
        pop.appendChild(g);
        [].forEach.call(c.children, addOp);
      } else if (!c.disabled && c.value) addOp(c);
    });
    wrap.appendChild(btn); wrap.appendChild(pop);
    sel.classList.add('ebsel-native');
    sel.setAttribute('tabindex', '-1'); sel.setAttribute('aria-hidden', 'true');
    sel.insertAdjacentElement('afterend', wrap);

    var act = -1;
    function sync() {
      var o = sel.selectedOptions[0], has = o && o.value;
      val.textContent = has ? o.textContent : 'Select an option';
      val.className = 'ebsel-val' + (has ? '' : ' ph');
      ops.forEach(function (b) { var on = has && b.getAttribute('data-v') === o.value; b.classList.toggle('on', !!on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    }
    function mark(i) {
      act = i;
      ops.forEach(function (b, k) { b.classList.toggle('act', k === i); });
      if (ops[i]) { ops[i].focus({ preventScroll: true }); ops[i].scrollIntoView({ block: 'nearest' }); }
    }
    function open() {
      var r = btn.getBoundingClientRect();
      var below = window.innerHeight - r.bottom - 14, above = r.top - 84; // the sticky menu covers the top 70px or so
      var up = below < 280 && above > below;
      wrap.classList.toggle('up', up);
      pop.style.maxHeight = Math.max(170, Math.min(340, up ? above : below)) + 'px';
      wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      var cur = ops.map(function (b) { return b.classList.contains('on'); }).indexOf(true);
      mark(cur < 0 ? 0 : cur);
    }
    function close(focusBtn) {
      wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
      ops.forEach(function (b) { b.classList.remove('act'); });
      if (focusBtn) btn.focus();
    }
    function pick(i) {
      sel.value = ops[i].getAttribute('data-v');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sync(); close(true);
    }
    btn.addEventListener('click', function () { wrap.classList.contains('open') ? close(false) : open(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ebsel-op') : null;
      if (b) pick(ops.indexOf(b));
    });
    pop.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(Math.min(ops.length - 1, act + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(Math.max(0, act - 1)); }
      else if (e.key === 'Home') { e.preventDefault(); mark(0); }
      else if (e.key === 'End') { e.preventDefault(); mark(ops.length - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') { close(false); }
      else if (e.key.length === 1) {
        var ch = e.key.toLowerCase();
        for (var k = 1; k <= ops.length; k++) { var j = (act + k) % ops.length; if (ops[j].textContent.toLowerCase().indexOf(ch) === 0) { mark(j); break; } }
      }
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(false); });
    if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(sync, 0); });
    sync();
  }

  function fixTopics() {
    [].forEach.call(document.querySelectorAll('select[name="topic"]'), function (s) {
      if (s.getAttribute('data-ebt')) return;
      s.setAttribute('data-ebt', '1');
      s.innerHTML = '<option value="" disabled selected>Select an option</option>' + TOPIC_GROUPS;
      enhanceSelect(s);
    });
  }

  // Every page ends with the same block: questions, then the enquiry form, right before the footer.
  var IQ_HEAD = "<section id=\"ebuddha-enquiry\" class=\"py-lg-80 py-64 wsc-iq-sec\"><style>.wsc-iq-sec{background:#F7F9FC}.wsc-iq-card{background:#fff;border:1px solid #E8ECF3;border-radius:18px;padding:26px}.wsc-iq-form .fld{margin-bottom:16px}.wsc-iq-form label{display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px}.wsc-iq-form input,.wsc-iq-form select,.wsc-iq-form textarea{width:100%;border:1px solid #DDE3ED;border-radius:10px;padding:11px 14px;font-size:14px;color:#0F172A;background:#fff;outline:none;font-family:inherit;transition:border-color .2s,box-shadow .2s}.wsc-iq-form input:focus,.wsc-iq-form select:focus,.wsc-iq-form textarea:focus{border-color:#194CFF;box-shadow:0 0 0 3px rgba(25,76,255,.12)}.wsc-iq-form textarea{min-height:96px;resize:vertical}.wsc-iq-btn{width:100%;background:#194CFF;color:#fff;border:0;border-radius:10px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;transition:background .2s}.wsc-iq-btn:hover{background:#1340D8}#ebuddha-enquiry .row>.col-lg-5{max-width:100%!important}.wsc-iq-form{display:grid;grid-template-columns:1fr 1fr;column-gap:20px}.wsc-iq-form .fld:nth-child(5),.wsc-iq-form .wsc-iq-btn,.wsc-iq-form .wsc-iq-ok{grid-column:1/-1}@media (max-width:575px){.wsc-iq-form{grid-template-columns:1fr}}.wsc-iq-ok{display:none;margin-top:14px;background:#ECFDF3;border:1px solid #ABEFC6;color:#067647;font-size:13px;line-height:20px;padding:10px 12px;border-radius:10px}.wsc-faq-item{background:#fff;border:1px solid #E8ECF3;border-radius:14px;margin-bottom:12px;overflow:hidden}.wsc-faq-item summary{list-style:none;cursor:pointer;padding:16px 20px;font-size:15px;font-weight:600;color:#0F172A;display:flex;align-items:center;justify-content:space-between;gap:16px}.wsc-faq-item summary::-webkit-details-marker{display:none}.wsc-faq-item summary::after{content:\"+\";font-size:22px;font-weight:400;color:#194CFF;flex:0 0 auto;line-height:1}.wsc-faq-item[open] summary::after{content:\"–\"}.wsc-faq-item .ans{padding:0 20px 18px;font-size:14px;line-height:22px;color:#475569;margin:0}</style><div class=\"container-main container-w-xl-1202\"><div class=\"text-center mb-40\"><h2 class=\"fs-lg-32 fs-24 lh-lg-48 lh-36 fw-lg-600 fw-700 text-color-1 mb-16\">Have a Question?</h2><p class=\"fs-14 lh-21 fw-400 text-color-7 mb-0\">Send us your details and our team will get back to you, or browse the common questions above.</p></div><div class=\"row\"><div class=\"col-lg-5 mb-4 mb-lg-0\"><div class=\"wsc-iq-card\"><form class=\"wsc-iq-form\"><div class=\"fld\"><label for=\"wsc-iq-name\">Full Name</label><input id=\"wsc-iq-name\" required=\"\" placeholder=\"Your name\" type=\"text\" name=\"name\"></div><div class=\"fld\"><label for=\"wsc-iq-phone\">Phone</label><input id=\"wsc-iq-phone\" placeholder=\"Optional\" type=\"tel\" name=\"phone\"></div><div class=\"fld\"><label for=\"wsc-iq-email\">Email</label><input id=\"wsc-iq-email\" required=\"\" placeholder=\"you@example.com\" type=\"email\" name=\"email\"></div><div class=\"fld\"><label for=\"wsc-iq-topic\">Interested in</label><select id=\"wsc-iq-topic\" name=\"topic\"><option value=\"\" disabled=\"\" selected=\"\">Select an option</option>" + TOPIC_GROUPS + "</select></div><div class=\"fld\"><label for=\"wsc-iq-msg\">Message</label><textarea id=\"wsc-iq-msg\" name=\"message\" placeholder=\"Tell us what you would like to know\"></textarea></div><button type=\"submit\" class=\"wsc-iq-btn\">Send Enquiry</button><div id=\"wsc-iq-ok\" class=\"wsc-iq-ok\" role=\"status\">Thanks! Your enquiry has been noted and our team will get back to you.</div></form></div></div>";
  var IQ_ITEMS = "<div class=\"col-lg-7\"><details class=\"wsc-faq-item\"><summary>How can I get more details about a program?</summary><p class=\"ans\">Share your details in the form and our team will send you the full curriculum, schedule and fee structure.</p></details><details class=\"wsc-faq-item\"><summary>What happens after I submit the form?</summary><p class=\"ans\">Your enquiry reaches our counseling team, who get in touch over email or phone to answer your questions.</p></details><details class=\"wsc-faq-item\"><summary>Can I request a callback at a specific time?</summary><p class=\"ans\">Yes. Add your phone number and mention a preferred time in the message box, and we will try to match it.</p></details><details class=\"wsc-faq-item\"><summary>I am not sure which program suits me. Can you help?</summary><p class=\"ans\">Tell us about your background and what you want to work towards, and we will suggest the closest fit.</p></details><details class=\"wsc-faq-item\"><summary>How do I reach you for anything else?</summary><p class=\"ans\">Use this form for program enquiries, or the contact links in the footer for everything else.</p></details></div>";
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
    var cur = document.getElementById('ebuddha-enquiry'), keep = '', topics = '';
    if (cur) {
      var fm = cur.querySelector('.wsc-iq-form');
      if (fm && window.getComputedStyle(fm).display === 'grid') return; // already the two-column form (home, events)
      // older single-column enquiry (about, hire-from-us): replace it with the new block
      cur.setAttribute('data-ebfq-old', '1');
      cur.removeAttribute('id');
      // the page's own "Interested in" choices carry over, and the hidden copy gives up its field ids
      var oldTopic = cur.querySelector('select[name="topic"]');
      if (oldTopic) topics = oldTopic.innerHTML;
      [].forEach.call(cur.querySelectorAll('.wsc-iq-form [id]'), function (el) { el.removeAttribute('id'); });
      // the page's own questions move into the new block (instead of the generic ones)
      var olds = cur.querySelectorAll('details.wsc-faq-item');
      if (olds.length) keep = '<div class="col-lg-7">' + [].map.call(olds, function (d) { return d.outerHTML; }).join('') + '</div>';
      [].forEach.call(olds, function (d) { d.className = ''; });
    }
    var foot = [].filter.call(document.querySelectorAll('footer'), function (x) { return x.offsetHeight > 0; })[0] || document.querySelector('footer');
    if (!foot || !foot.parentNode) return;
    var own = hasOwnFaq();
    var wrap = document.createElement('div');
    wrap.setAttribute('data-iq-added', '1');
    var head = own ? IQ_HEAD.replace('col-lg-5 mb-4 mb-lg-0', 'col-12') : IQ_HEAD;
    wrap.innerHTML = '<div data-faq-after="1" aria-hidden="true"></div>' + head + (own ? '' : (keep || IQ_ITEMS)) + IQ_TAIL;
    foot.parentNode.insertBefore(wrap, foot);
    iqFallbacks(wrap.querySelector('section'));
    var sel = wrap.querySelector('select[name="topic"]');
    if (sel && topics) sel.innerHTML = topics;
    var f = wrap.querySelector('.wsc-iq-form');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(f), NL = String.fromCharCode(10);
      var t = 'Hi eBuddha Digitech, I have a question.' + NL + 'Name: ' + (d.get('name') || '') + NL + 'Email: ' + (d.get('email') || '') + NL +
        'Phone: ' + (d.get('phone') || '-') + NL + 'City: ' + (d.get('city') || '-') + NL + 'Interested in: ' + (d.get('topic') || '-') + NL + 'Message: ' + (d.get('message') || '-');
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
      items = [].map.call(w, function (d) { return { q: txt(d.querySelector('summary')), a: '<p>' + ((d.querySelector('.ans') || {}).innerHTML || '') + '</p>', cat: d.getAttribute('data-cat') || '' }; });
      var sec = document.getElementById('ebuddha-enquiry');
      var ch = document.querySelector('.eb-ch-sec');
      var ref = sec;
      if (ch && (!sec || (sec.compareDocumentPosition(ch) & 4))) ref = ch; // whichever comes last on the page
      var mc = ch && document.querySelector('section.master-classes-section');
      if (mc) ref = mc; // home: FAQ sits right after Free Masterclasses
      var fa = document.querySelector('[data-faq-after]');
      if (fa) ref = fa; // a page can name its own spot: /events, and home (its services section, just above the enquiry form)
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
    return null;
  }

  // tabs and accordion for a finished .ebfq section (built here, or shipped in the page's html by tools/prerender-faq.js)
  function bind(sec) {
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
  }

  function build(info) {
    if (!document.getElementById('ebfq-css')) {
      var st = document.createElement('style');
      st.id = 'ebfq-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var sec = document.createElement('section');
    sec.className = 'ebfq';
    sec.setAttribute('data-ebfq', '1');
    var chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    // a page can name its own categories (data-cat on each question); otherwise they are worked out from the wording
    var own = [];
    info.items.forEach(function (it) { if (it.q && it.cat && own.indexOf(it.cat) < 0) own.push(it.cat); });
    if (own.length && info.items.some(function (it) { return it.q && !it.cat; }) && own.indexOf('Others') < 0) own.push('Others');
    var cats = info.cats || (own.length ? own : CATS);
    var catOf = function (it) { return info.cats ? it.ci : own.length ? own.indexOf(it.cat || 'Others') : category(it.q); };
    var list = '', used = {};
    info.items.forEach(function (it) { if (it.q) used[catOf(it)] = 1; });
    info.items.forEach(function (it, n) {
      if (!it.q) return;
      list += '<div class="ebfq-item" data-c="' + catOf(it) + '"><button type="button" class="ebfq-q" aria-expanded="false"><span></span>' + chev + '</button><div class="ebfq-a" role="region"><div class="ebfq-ai">' + it.a + '</div></div></div>';
    });
    sec.innerHTML = '<div class="ebfq-in"><h2 class="ebfq-h">Frequently Asked <span>Questions</span></h2><div class="ebfq-grid"><aside class="ebfq-side"><button type="button" class="ebfq-tab on" data-c="">All Questions</button>' + cats.map(function (c, i) { return !used[i] ? '' : '<button type="button" class="ebfq-tab" data-c="' + i + '">' + c + '</button>'; }).join('') + '</aside><div class="ebfq-list">' + list + '<div class="ebfq-empty" hidden>No questions in this category yet. Choose All Questions to see everything.</div></div></div></div>';
    var qs = sec.querySelectorAll('.ebfq-q span'), k = 0;
    info.items.forEach(function (it) { if (it.q) { qs[k++].textContent = it.q.replace(/^\s*\d+\s*[.)]\s*/, ''); } });
    bind(sec);
    return sec;
  }

  function run() {
    if (document.querySelector('[data-ebfq]')) { ensureEnquiry(); fixTopics(); upgradeForms(); return true; }
    ensureEnquiry();
    fixTopics();
    upgradeForms();
    var info = find();
    if (!info || !info.items.length) return false;
    // the page may already carry its finished FAQ in the html (crawlers and no-script visitors read it); just wire it up
    var sec = document.querySelector('[data-ebfq-static]');
    if (sec) { sec.removeAttribute('data-ebfq-static'); sec.setAttribute('data-ebfq', '1'); bind(sec); }
    else {
      if (FD) info = applyData(info);
      sec = build(info);
    }
    info.old.forEach(function (o) {
      if (!o) return;
      o.setAttribute('data-ebfq-old', '1');
      if (o.id) o.removeAttribute('id');
    });
    if (info.id) sec.id = info.id;
    if (info.widen) {
      // the enquiry form was in a narrow left column next to the questions: center it now
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

  // ---- site-wide fixes -------------------------------------------------------------------------------------------
  (function () {
    if (window.__ebFixes) return;
    window.__ebFixes = 1;
    var WA = 'https://wa.me/918461958162?text=';

    // 1. lead buttons: the old pop-up form posts to a server that does not exist, so take visitors to the enquiry form
    var LEAD = /(request\s+(a\s+)?call\s*back|talk\s+to\s+(our\s+)?(program\s+)?(advisor|counsel+or)|book\s+(a\s+)?(free\s+)?(demo|class|session)|get\s+(a\s+)?(free\s+)?(counsel+ing|consultation|call\s*back)|download\s+(the\s+)?(curriculum|brochure|syllabus)|schedule\s+a\s+call|apply\s+now|enroll+\s*now|register\s+now)/i;
    // "Download Curriculum" opens its own pop-up form (same fields as the enquiry form, sent the same way, to WhatsApp)
    var CURR = /download\s+(the\s+)?(curriculum|brochure|syllabus)/i, REP = /download\s+(the\s+)?(placement\s+)?report/i;
    var CM_CSS = '.ebcm{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.ebcm-bd{position:absolute;inset:0;background:rgba(8,18,52,.6);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}' +
      '.ebcm-box{position:relative;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);width:100%;max-width:900px;max-height:calc(100vh - 40px);overflow:auto;border-radius:22px;background:#fff;box-shadow:0 30px 80px rgba(4,14,50,.45);animation:ebcmIn .28s cubic-bezier(.2,.7,.2,1)}' +
      '@keyframes ebcmIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}' +
      '.ebcm-x{position:absolute;top:14px;right:14px;z-index:2;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:0;border-radius:50%;background:#F1F4FA;color:#0F172A;font-size:20px;line-height:1;cursor:pointer}' +
      '.ebcm-x:hover{background:#E3E9F5}' +
      '.ebcm-side{position:relative;display:flex;flex-direction:column;gap:16px;padding:34px 30px;color:#fff;background:radial-gradient(rgba(255,255,255,.08) 1px,transparent 1px) 0 0/20px 20px,linear-gradient(160deg,#194CFF 0%,#0A2BB8 100%)}' +
      '.ebcm-chip{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 5px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.26);color:#fff;font-size:13px;line-height:18px;font-weight:600;letter-spacing:.01em;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}' +
      '.ebcm-chip i{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:linear-gradient(145deg,#FFF1C2,#FFD36B 50%,#F2AE2E);color:#0A1F66}.ebcm-chip i svg{width:13px;height:13px}.ebcm-chip b{font-weight:700;color:#FFD36B}' +
      '.ebcm-side h3{margin:0;font-size:26px;line-height:33px;font-weight:700;color:#fff}' +
      '.ebcm-side ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}' +
      '.ebcm-side li{display:flex;gap:10px;font-size:14.5px;line-height:21px;color:#DCE6FF}' +
      '.ebcm-side li:before{content:"";flex:0 0 20px;height:20px;border-radius:50%;background:#FFC24B url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%230A1F66%27 stroke-width=%273.2%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M5 12.5l4.5 4.5L19 7.5%27/%3E%3C/svg%3E") center/12px no-repeat}' +
      '.ebcm-trust{margin:auto 0 0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.1);font-size:13.5px;line-height:19px;color:#fff}.ebcm-trust b{color:#FFD36B}' +
      '.ebcm .ebcm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:34px 30px 28px;margin:0}' +
      '.ebcm-form h3{grid-column:1/-1;margin:0;padding-right:40px;font-size:24px;line-height:31px;font-weight:700;color:#0F172A}' +
      '.ebcm-sub{grid-column:1/-1;margin:-6px 0 4px;font-size:14px;line-height:21px;color:#64748B}' +
      '.ebcm .ebcm-form .fld{display:flex;flex-direction:column;gap:6px;min-width:0;margin:0!important;grid-column:auto!important}.ebcm .ebcm-form .fld.eb-full{grid-column:1/-1!important}.ebcm .ebcm-form .fld>label{margin:0}' +
      '.ebcm-form label{font-size:13px;line-height:18px;font-weight:600;color:#1E293B}.ebcm-form label i{font-style:normal;color:#E11D48}' +
      '.ebcm-form input[type=text],.ebcm-form input[type=tel],.ebcm-form input[type=email],.ebcm-form select,.ebcm-form textarea{width:100%;padding:11px 14px;border:1px solid #DDE3ED;border-radius:10px;background:#fff;color:#0F172A;font:inherit;font-size:14px;line-height:20px;outline:0;transition:border-color .2s,box-shadow .2s}' +
      '.ebcm-form textarea{min-height:76px;resize:vertical}' +
      '.ebcm .ebcm-form input,.ebcm .ebcm-form input:focus,.ebcm .ebcm-form textarea,.ebcm .ebcm-form textarea:focus{background-image:none!important;padding-left:14px!important}' +
      '.ebcm-form input:focus,.ebcm-form select:focus,.ebcm-form textarea:focus{border-color:#194CFF;box-shadow:0 0 0 3px rgba(25,76,255,.12)}' +
      '.ebcm-ok{grid-column:1/-1;display:flex;align-items:flex-start;gap:10px;font-size:13px!important;line-height:19px!important;font-weight:400!important;color:#475569!important;cursor:pointer}' +
      '.ebcm .ebcm-form label.ebcm-ok{display:flex!important;align-items:flex-start;gap:10px;margin:2px 0 0!important}.ebcm .ebcm-form label.ebcm-ok>span{flex:1 1 auto;min-width:0}.ebcm .ebcm-form select{padding-right:34px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.ebcm .ebcm-ok input{flex:0 0 auto;width:18px!important;height:18px;margin:1px 0 0;padding:0!important;accent-color:#194CFF;cursor:pointer}' +
      '.ebcm-ok a{color:#194CFF;font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
      '.ebcm-btn{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:10px;min-height:50px;border:0;border-radius:12px;background:#194CFF;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer;transition:background .2s,opacity .2s}' +
      '.ebcm-btn:hover{background:#0F3BD6}.ebcm-btn:disabled{opacity:.45;cursor:not-allowed}.ebcm-btn svg{width:18px;height:18px}' +
      '.ebcm-form .wsc-iq-ok{grid-column:1/-1;display:none;margin:0;padding:10px 12px;border-radius:10px;background:#ECFDF3;color:#067647;font-size:13.5px;line-height:19px}' +
      '@media (max-width:767px){.ebcm{align-items:flex-end;padding:0}.ebcm-box{grid-template-columns:minmax(0,1fr);max-height:92vh;border-radius:22px 22px 0 0}.ebcm-side{display:none}.ebcm .ebcm-form{grid-template-columns:minmax(0,1fr);padding:26px 18px 22px}.ebcm-form h3{font-size:21px;line-height:28px}}' +
      '.ebcm-art{display:block;width:100%;max-width:320px;margin:auto auto 18px;overflow:visible}' +
      '.ebcm-art .a-rocket{animation:ebcmRocket 3.2s ease-in-out infinite}' +
      '.ebcm-art .a-flame{transform-box:fill-box;transform-origin:50% 0;animation:ebcmFlame .35s ease-in-out infinite alternate}' +
      '.ebcm-art .a-chip{animation:ebcmFloat 4s ease-in-out infinite}.ebcm-art .a-chip.d2{animation-delay:-1s}.ebcm-art .a-chip.d3{animation-delay:-2s}.ebcm-art .a-chip.d4{animation-delay:-3s}' +
      '.ebcm-art .a-bar{transform-box:fill-box;transform-origin:50% 100%;animation:ebcmBar 2.4s ease-in-out infinite alternate}.ebcm-art .a-bar.b2{animation-delay:.3s}.ebcm-art .a-bar.b3{animation-delay:.6s}' +
      '.ebcm-art .a-dash{stroke-dasharray:4 5;animation:ebcmDash 1.6s linear infinite}' +
      '@keyframes ebcmRocket{0%,100%{transform:translate(0,0)}50%{transform:translate(4px,-8px)}}' +
      '@keyframes ebcmFlame{from{transform:scaleY(.75);opacity:.85}to{transform:scaleY(1.15);opacity:1}}' +
      '@keyframes ebcmFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}' +
      '@keyframes ebcmBar{from{transform:scaleY(.55)}to{transform:scaleY(1)}}' +
      '@keyframes ebcmDash{to{stroke-dashoffset:-18}}' +
      '@media (prefers-reduced-motion:reduce){.ebcm-box{animation:none}.ebcm-art *{animation:none!important}}';
    // illustration for the pop-up: a learning window with a rocket taking off, growth bars and floating outcome tags
    var chip = function (x, y, w, t, d) { return '<g class="a-chip ' + d + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="26" rx="13" fill="#2D5BFF" stroke="rgba(255,255,255,.5)"/><text x="' + (x + w / 2) + '" y="' + (y + 17) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="Inter,Poppins,sans-serif">' + t + '</text></g>'; };
    var CM_ART = '<svg class="ebcm-art" viewBox="0 0 300 240" aria-hidden="true">' +
      '<path d="M40 20l26-15 26 15v30l-26 15-26-15z" fill="rgba(255,255,255,.05)"/><path d="M220 150l30-17 30 17v34l-30 17-30-17z" fill="rgba(255,255,255,.05)"/>' +
      '<path class="a-dash" d="M58 118c-20 10-22 34 2 44" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.5"/><path class="a-dash" d="M150 196c10 18 34 18 48 6" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.5"/>' +
      '<rect x="78" y="64" width="150" height="112" rx="12" fill="#fff"/><rect x="78" y="64" width="150" height="24" rx="12" fill="#EEF2FF"/><rect x="78" y="80" width="150" height="8" fill="#EEF2FF"/>' +
      '<circle cx="92" cy="76" r="4.5" fill="#C7D2FE"/><circle cx="106" cy="76" r="4.5" fill="#C7D2FE"/><rect x="118" y="71" width="44" height="10" rx="5" fill="none" stroke="#C7D2FE" stroke-width="2"/>' +
      '<rect x="92" y="100" width="70" height="7" rx="3.5" fill="#DCE5FF"/><rect x="92" y="113" width="52" height="7" rx="3.5" fill="#E8EEFF"/>' +
      '<circle cx="104" cy="160" r="20" fill="#E6EBFF"/><circle cx="130" cy="166" r="16" fill="#EEF2FF"/><circle cx="156" cy="162" r="18" fill="#E6EBFF"/><rect x="84" y="162" width="100" height="14" fill="#E6EBFF"/>' +
      '<g class="a-rocket"><g transform="rotate(40 190 92)">' +
      '<path class="a-flame" d="M181 122c2 14 9 22 9 22s7-8 9-22z" fill="#FFC24B"/><path class="a-flame" d="M185 122c1 9 5 14 5 14s4-5 5-14z" fill="#FF8A3D"/>' +
      '<path d="M190 52c13 12 16 36 12 70h-24c-4-34-1-58 12-70z" fill="#E0E7FF"/><path d="M190 52c6 6 10 14 12 24h-24c2-10 6-18 12-24z" fill="#1E3A8A"/>' +
      '<circle cx="190" cy="92" r="7.5" fill="#fff" stroke="#A5B4FC" stroke-width="3"/>' +
      '<path d="M178 104l-12 18h13z" fill="#4F46E5"/><path d="M202 104l12 18h-13z" fill="#4F46E5"/></g></g>' +
      '<g transform="translate(196 176)"><rect width="66" height="52" rx="9" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.4)"/><rect x="12" y="10" width="42" height="4" rx="2" fill="#fff"/>' +
      '<rect class="a-bar" x="13" y="28" width="9" height="16" rx="2" fill="#fff"/><rect class="a-bar b2" x="28" y="22" width="9" height="22" rx="2" fill="#fff"/><rect class="a-bar b3" x="43" y="16" width="9" height="28" rx="2" fill="#FFC24B"/></g>' +
      chip(70, 28, 112, 'Job-Ready Skills', 'd1') + chip(2, 160, 92, 'Live Projects', 'd2') + chip(214, 118, 84, 'Better Pay', 'd3') + chip(52, 206, 140, '{{PLACEMENT}}', 'd4') +
      '</svg>';
    function curriculumPopup(btn, kind) {
      var isRep = kind === 'report';
      if (!document.getElementById('ebcm-css')) { var st = document.createElement('style'); st.id = 'ebcm-css'; st.textContent = CM_CSS; document.head.appendChild(st); }
      var old = document.querySelector('.ebcm'); if (old) old.remove();
      // only the courses of the program the button belongs to: Full Stack on its own, or the two Digital Marketing
      // courses (classroom and online); the exact course is picked for them
      var C_BPL = 'Digital Marketing Course in Bhopal (Classroom)', C_ONL = 'Online Digital Marketing Course', C_FS = 'Full Stack Development with AI Engineering';
      var card = (btn.closest('[class*="card"]') || {}).textContent || '', path = location.pathname;
      var isFS = /full-stack/.test(path) || /full\s*stack/i.test(card);
      var topic = isFS ? C_FS : /online-digital/.test(path) || /\bonline\b/i.test(card) ? C_ONL : C_BPL;
      // the placement report covers every program, so outside a course page or card it lists all three
      var any = isRep && !/full-stack|digital-marketing-course-in-bhopal|online-digital/.test(path) && !card;
      var opts = (any ? [C_BPL, C_ONL, C_FS] : isFS ? [C_FS] : [C_BPL, C_ONL])
        .map(function (o) { return '<option value="' + o + '"' + (o === topic ? ' selected' : '') + '>' + o + '</option>'; }).join('');
      var points = isRep ? '<li>Where our learners got placed in 2025-26, with roles and packages</li>' : '<li>Module-by-module syllabus with the tools used in each</li>';
      var m = document.createElement('div');
      m.className = 'ebcm';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'ebcm-h');
      m.innerHTML = '<div class="ebcm-bd" data-ebcm-close></div><div class="ebcm-box"><button type="button" class="ebcm-x" aria-label="Close" data-ebcm-close>&times;</button>' +
        '<div class="ebcm-side"><span class="ebcm-chip"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg></i><span><b>Free</b> ' + (isRep ? 'Placement Report 2025-26' : 'Course Curriculum') + '</span></span><h3>' + (isRep ? 'See where our learners got placed' : 'See exactly what you will learn') + '</h3><ul>' +
        points + '</ul>' + CM_ART.replace('{{PLACEMENT}}', isFS ? 'Placement Assistance' : 'Placement Guarantee') +
        '<p class="ebcm-trust"><b>&#9733; 5.0</b> on Google from 119 reviews</p></div>' +
        '<form class="wsc-iq-form ebcm-form" data-ebu="1" data-wa="' + (isRep ? 'get the Placement Report 2025-26' : 'get the course curriculum') + '">' +
        '<h3 id="ebcm-h">' + (isRep ? 'Download Placement Report' : 'Download Curriculum') + '</h3><p class="ebcm-sub">Share your details and our team will send you the ' + (isRep ? 'Placement Report 2025-26' : 'curriculum') + '.</p>' +
        '<div class="fld"><label for="ebcm-name">Full Name</label><input id="ebcm-name" name="name" type="text" required placeholder="Your name" autocomplete="off"></div>' +
        '<div class="fld"><label for="ebcm-phone">Phone</label><input id="ebcm-phone" name="phone" type="tel" required inputmode="tel" autocomplete="off" placeholder="10-digit mobile number" pattern="[+]?[0-9][0-9 \\-]{8,16}[0-9]" title="Enter a valid phone number, for example 98765 43210"></div>' +
        '<div class="fld"><label for="ebcm-email">Gmail</label><input id="ebcm-email" name="email" type="email" required placeholder="yourname@gmail.com" autocomplete="off"></div>' +
        '<div class="fld"><label for="ebcm-city">City</label><input id="ebcm-city" name="city" type="text" required placeholder="Your city, e.g. Bhopal" autocomplete="off"></div>' +
        '<div class="fld"><label for="ebcm-occ">Occupation</label><select id="ebcm-occ" name="occupation" required><option value="" disabled selected>Select occupation</option>' +
        ['Student', 'Job Seeker', 'Working Professional', 'Homemaker', 'Business Owner', 'Graduate'].map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld"><label for="ebcm-edu">Highest Education</label><select id="ebcm-edu" name="education" required><option value="" disabled selected>Select education</option>' +
        ['11th Appearing', '12th Appearing', '12th Pass', 'BA', 'BBA', 'BCA', 'B.Com', 'B.Sc', 'B.Tech', 'MA', 'MBA', 'MCA', 'M.Com', 'M.Sc', 'M.Tech', 'Other'].map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld eb-full"><label for="ebcm-topic">Course</label><select id="ebcm-topic" name="topic">' + opts + '</select></div>' +
        '<label class="ebcm-ok"><input type="checkbox" name="consent" required> <span>I have read and agree to the <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a> and <a href="/terms-and-conditions" target="_blank" rel="noopener">Terms &amp; Conditions</a>.</span></label>' +
        '<label class="ebcm-ok ebcm-wa"><input type="checkbox" name="wa_updates" value="Yes"> <span>Send me updates on WhatsApp</span></label>' +
        '<button type="submit" class="ebcm-btn" disabled>' + (isRep ? 'Get Report' : 'Get Curriculum') + ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg></button>' +
        '<p class="wsc-iq-ok" role="status">Thanks! WhatsApp is opening with your details. Send the message and our team will share the ' + (isRep ? 'placement report' : 'curriculum') + '.</p></form></div>';
      document.body.appendChild(m);
      var prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      var f = m.querySelector('form'), ok = f.querySelector('input[name="consent"]'), sb = f.querySelector('.ebcm-btn');
      var sync = function () { sb.disabled = !ok.checked; };
      ok.addEventListener('change', sync);
      f.addEventListener('reset', function () { setTimeout(sync, 0); });
      var close = function () { m.remove(); document.body.style.overflow = prevOverflow; document.removeEventListener('keydown', onKey); if (btn.focus) btn.focus(); };
      var onKey = function (e) { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      [].forEach.call(m.querySelectorAll('[data-ebcm-close]'), function (x) { x.addEventListener('click', close); });
      setTimeout(function () { var n = f.querySelector('#ebcm-name'); if (n) n.focus(); }, 60);
    }

    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;
      if (!t || t.closest('#ebuddha-enquiry, .wsc-iq-form, form, .ebfq, footer, .eb-pn, .ebcm')) return;
      var label = (t.textContent || '').replace(/\s+/g, ' ').trim();
      if (CURR.test(label) || REP.test(label)) { e.preventDefault(); e.stopImmediatePropagation(); curriculumPopup(t, REP.test(label) ? 'report' : 'curriculum'); return; }
      if (!LEAD.test(label)) return;
      var box = document.getElementById('ebuddha-enquiry');
      if (!box) return;
      e.preventDefault();
      e.stopPropagation();
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, true);

    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-eb-advisor]') : null;
      if (!t || t.closest('.eb-co-sec')) return;
      var box = document.getElementById('ebuddha-enquiry');
      if (!box) return;
      e.preventDefault();
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, true);

    // 2. enquiry form: details go to WhatsApp (also stops the older handlers that only showed a thank-you)
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || !f.matches || !f.matches('.wsc-iq-form, form[data-wa]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var d = new FormData(f), NL = String.fromCharCode(10);
      var t = 'Hi eBuddha Digitech, ' + (f.getAttribute('data-wa') ? 'I would like to: ' + f.getAttribute('data-wa') + '.' : 'I have a question.') + NL + 'Name: ' + (d.get('name') || '') + NL + 'Email: ' + (d.get('email') || '') + NL +
        'Phone: ' + (d.get('phone') || '-') + NL + 'City: ' + (d.get('city') || '-') +
        (d.has('occupation') ? NL + 'Occupation: ' + (d.get('occupation') || '-') : '') + (d.has('education') ? NL + 'Highest education: ' + (d.get('education') || '-') : '') +
        NL + (f.classList.contains('ebcm-form') ? 'Course: ' : 'Interested in: ') + (d.get('topic') || '-') +
        (f.querySelector('[name="message"]') ? NL + 'Message: ' + (d.get('message') || '-') : '') +
        (f.querySelector('[name="wa_updates"]') ? NL + 'Updates on WhatsApp: ' + (d.get('wa_updates') ? 'Yes' : 'No') : '');
      window.open(WA + encodeURIComponent(t), '_blank', 'noopener');
      var ok = f.querySelector('.wsc-iq-ok') || document.getElementById('wsc-iq-ok');
      if (ok) ok.style.display = 'block';
      f.reset();
    }, true);

    // 3. broken images: try the local copy of the original file, then show a neutral placeholder
    var PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#EAF0FF"/><g fill="none" stroke="#9DB6EA" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><rect x="140" y="95" width="120" height="90" rx="10"/><circle cx="175" cy="125" r="9"/><path d="M146 178l36-34 26 24 18-16 34 30"/></g></svg>');
    document.addEventListener('error', function (e) {
      var im = e.target;
      if (!im || im.tagName !== 'IMG' || im.__ebFix === 2) return;
      var src = im.currentSrc || im.getAttribute('src') || '';
      if (src.indexOf('data:') === 0) return;
      if (!im.__ebFix) {
        im.__ebFix = 1;
        var m = /[?&@]url=([^&]+)/.exec(src), u = '';
        try { u = m ? decodeURIComponent(decodeURIComponent(m[1])) : ''; } catch (x) { u = ''; }
        if (!u) u = src; // an image linked straight to the CDN (no optimizer URL), such as an SVG logo
        im.__ebCdn = /^https?:\/\/deen3evddmddt\.cloudfront\.net\//.test(u) ? u : '';
        u = u.replace(/^https?:\/\/deen3evddmddt\.cloudfront\.net\//, '/deen3evddmddt.cloudfront.net/');
        if (u && u.charAt(0) === '/' && (im.getAttribute('src') || '') !== u) {
          im.removeAttribute('srcset');
          im.src = u;
          return;
        }
      }
      if (im.__ebFix === 1 && im.__ebCdn) { // no local copy: ask the CDN for the original file before giving up
        im.__ebFix = 3;
        im.removeAttribute('srcset');
        im.src = im.__ebCdn;
        return;
      }
      im.__ebFix = 2;
      im.removeAttribute('srcset');
      im.src = PH;
      im.style.objectFit = 'contain';
      im.style.background = '#EAF0FF';
    }, true);
  })();

  // ---- scroll reveal for the "Who Can Learn With Us" section ------------------------------------------------------
  (function () {
    if (window.__ebWl) return;
    window.__ebWl = 1;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || !('IntersectionObserver' in window)) return;
    function bind() {
      ['.eb-wl-sec', '.eb-pr-sec'].forEach(function (sel) {
        var s = document.querySelector(sel);
        if (!s || s.getAttribute('data-wlobs')) return;
        s.setAttribute('data-wlobs', '1');
        s.classList.add('eb-js');
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) { s.classList.add('eb-in'); io.disconnect(); }
          });
        }, { threshold: 0.18 });
        io.observe(s);
      });
    }
    bind();
    var n = 0, t = setInterval(function () { bind(); if (++n > 20) clearInterval(t); }, 500);
  })();

  function isHydrated() {
    // Next pages carry their page data inline; plain static pages (blog, services, legal, refer) do not
    return [].some.call(document.scripts, function (s) { return !s.src && /__next_f\.push/.test(s.textContent || ''); });
  }

  function start() { loadData(begin); }

  function begin() {
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

// ---- safety net for scroll animations ----------------------------------------------------------------------------------------
// Sections that fade in are written into the page as opacity:0 plus a small slide, and the page's animation code lifts them.
// If that code is late or stalls (hidden tab, slow phone, a hydration hiccup) the section stays invisible, so a blank gap shows.
// Anything still at opacity:0 with a slide once it has been on screen for 1.5s is lifted here.
(function () {
  if (window.__ebReveal || !('IntersectionObserver' in window)) return;
  window.__ebReveal = 1;
  var HID = /(^|;)\s*opacity:\s*0(\.0+)?\s*(;|$)/;
  function stuck(el) {
    var s = el.getAttribute('style') || '';
    return HID.test(s) && /translate/.test(s);
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      io.unobserve(el);
      setTimeout(function () {
        if (!stuck(el)) return;
        el.style.transition = 'opacity .5s ease, transform .5s ease';
        el.style.opacity = '1';
        el.style.transform = 'none';
      }, 1500);
    });
  }, { threshold: 0.05 });
  function scan() {
    var list = document.querySelectorAll('[style*="opacity"]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.__ebW || el.closest('header, nav, [aria-hidden="true"], [hidden]')) continue;
      if (stuck(el)) { el.__ebW = 1; io.observe(el); }
    }
  }
  var t;
  function soon() { clearTimeout(t); t = setTimeout(scan, 250); }
  window.addEventListener('load', function () { scan(); setTimeout(scan, 1500); setTimeout(scan, 4000); });
  window.addEventListener('scroll', soon, { passive: true });
  window.addEventListener('resize', soon);
})();
