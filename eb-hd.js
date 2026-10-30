/* Phone menu for the blog and resources header, built to match the home page menu:
   a blue drawer (About Us, Resources, Services, Alumni, Hire From Us, Contact Us, Login / Join for Free),
   a white panel for Our Courses and a white panel for Our Services. */
(function () {
  var h = document.getElementById("eb-hd");
  if (!h || h.__ebM) return;
  h.__ebM = 1;

  var CDN = "https://deen3evddmddt.cloudfront.net/uploads/category-images/";
  var C = [
    { n: "Digital Marketing", c: [
      ["Digital Marketing Course with GenAI", "/digital-marketing-course-in-bhopal", "digital-marketing-icon.svg", 0, "Learn digital marketing with practical projects and AI-powered tools."],
      ["Online Digital Marketing Course", "/online-digital-marketing-course", "performance-marketing-icon.svg", 1, "Learn digital marketing online with practical training and GenAI tools."]] },
    { n: "Full Stack Development", c: [
      ["Full Stack Development with AI Engineering", "/full-stack-developer-course", "full-stack-development-icon.svg", 0, "Build modern web applications with full-stack and AI engineering skills"]] }
  ];
  var S = { n: "Services We Offer", c: [
    ["Digital Marketing Services", "/digital-marketing-services", "digital-marketing-icon.svg", 0, "All four services together, so you can pick where to start."],
    ["Search Engine Optimization", "/services/seo", "seo-specialist-icon.svg", 0, "Be found on Google and the map with local and technical SEO."],
    ["Social Media Marketing", "/services/social-media-marketing", "digital-marketing-icon.svg", 0, "Posts, reels and community care that keep your brand remembered."],
    ["Performance Marketing", "/services/performance-marketing", "performance-marketing-icon.svg", 0, "Google and Meta ads checked weekly against your cost per lead."],
    ["Website Design & Development", "/services/website-design-development", "full-stack-development-icon.svg", 0, "Fast mobile-first sites built to rank and win enquiries."]] };

  var RS = { n: "Resources", c: [
    ["Our Tools", "/tools", "/images/icons/tools-icon.svg", 0, "Free tools for SEO, ads, social media and content."],
    ["Case Studies", "/case-studies", "/images/icons/case-studies-icon.svg", 0, "Real brand stories and the lessons behind them."]] };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  var CHEV = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 12L10 8L6 4" stroke="#194cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var BACK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 12L6 8L10 4" stroke="#194cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var X = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M12 4L4 12M4 4L12 12" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function card(it) {
    return '<a class="eb-mg-card" href="' + it[1] + '"><span class="eb-mg-ic"><img src="' + (it[2].charAt(0) === "/" ? "" : CDN) + it[2] + '" width="40" height="40" alt=""></span><span class="eb-mg-tx"><span class="eb-mg-n">' + esc(it[0]) + '</span>' + (it[4] ? '<span class="eb-mg-d">' + esc(it[4]) + '</span>' : "") + '</span>' + (it[3] ? '<img class="eb-mg-new" src="/images/icons/new-tag-2.svg" width="32" height="20" alt="New">' : "") + "</a>";
  }

  // blue drawer + dark overlay
  var ov = el("div", "eb-md-ov");
  var dr = el("div", "eb-md");
  dr.id = "eb-hd-drawer";
  dr.setAttribute("aria-label", "Menu");
  dr.innerHTML = '<nav class="eb-md-links"><a href="/about-us">About Us</a><button type="button" data-go="resources">Resources</button><button type="button" data-go="services">Services</button><a href="/alumni">Alumni</a><a href="/hire-from-us">Hire From Us<i class="eb-hd-dot"></i></a><a href="/contact-us">Contact Us</a></nav><div class="eb-md-auth"><a href="/contact-us">Login</a><a href="/contact-us">Join for Free</a></div>';

  // white panel (courses list, then cards)
  var mg = el("div", "eb-mg");
  mg.setAttribute("role", "dialog");
  mg.setAttribute("aria-label", "Menu");
  mg.innerHTML = '<div class="eb-mg-top"><a href="/" aria-label="eBuddha Digitech home"><img src="/images/ebuddha-logo.svg" width="90" height="40" alt="eBuddha Digitech"></a><button type="button" class="eb-mg-x" aria-label="Close menu">' + X + '</button></div><div class="eb-mg-body"><div class="eb-mg-v eb-mg-l1"></div><div class="eb-mg-v eb-mg-l2"></div></div>';

  document.body.appendChild(ov);
  document.body.appendChild(dr);
  document.body.appendChild(mg);

  var burger = h.querySelector(".eb-hd-burger");
  var l1 = mg.querySelector(".eb-mg-l1"), l2 = mg.querySelector(".eb-mg-l2");
  var root = document.documentElement;

  function lock(o) { root.classList.toggle("eb-md-lock", o); }
  function drawerOpen(o) {
    if (o) { var b = Math.max(h.getBoundingClientRect().bottom, 0); dr.style.top = b + "px"; ov.style.top = "0"; }
    h.classList.toggle("is-open", o);
    dr.classList.toggle("in", o);
    ov.classList.toggle("in", o);
    burger.setAttribute("aria-expanded", o ? "true" : "false");
    burger.setAttribute("aria-label", o ? "Close menu" : "Open menu");
    lock(o || mg.classList.contains("in"));
  }
  function megaOpen(o) {
    mg.classList.toggle("in", o);
    if (!o) mg.classList.remove("lvl2");
    lock(o || dr.classList.contains("in"));
  }
  function showCards(title, cards, backTo) {
    l2.innerHTML = '<button type="button" class="eb-mg-back" data-back="' + backTo + '">' + BACK + esc(title) + "</button>" + cards;
    l2.scrollTop = 0;
    mg.classList.add("lvl2");
  }
  function openCourses() {
    drawerOpen(false);
    l1.innerHTML = '<p class="eb-mg-t">Our Courses</p>' + C.map(function (g, i) { return '<button type="button" class="eb-mg-row" data-i="' + i + '"><span>' + esc(g.n) + "</span>" + CHEV + "</button>"; }).join("");
    mg.classList.remove("lvl2");
    megaOpen(true);
  }
  function openServices() {
    drawerOpen(false);
    l1.innerHTML = "";
    showCards("Our Services", '<p class="eb-mg-sub">' + esc(S.n) + "</p>" + S.c.map(card).join(""), "close");
    megaOpen(true);
  }
  function openResources() {
    drawerOpen(false);
    l1.innerHTML = "";
    showCards("Resources", '<p class="eb-mg-sub">' + esc(RS.n) + "</p>" + RS.c.map(card).join(""), "close");
    megaOpen(true);
  }
  function closeAll() { drawerOpen(false); megaOpen(false); }

  burger.setAttribute("aria-controls", "eb-hd-drawer");
  burger.addEventListener("click", function () {
    if (mg.classList.contains("in")) { megaOpen(false); return; }
    drawerOpen(!dr.classList.contains("in"));
  });
  var cb = h.querySelector(".eb-hd-mc");
  if (cb) cb.addEventListener("click", openCourses);
  ov.addEventListener("click", function () { drawerOpen(false); });
  dr.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    if (t.closest("[data-go=services]")) { openServices(); return; }
    if (t.closest("[data-go=resources]")) { openResources(); return; }
    if (t.closest("a")) drawerOpen(false);
  });
  mg.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest(".eb-mg-x")) { megaOpen(false); return; }
    var back = t.closest(".eb-mg-back");
    if (back) { if (back.getAttribute("data-back") === "close") megaOpen(false); else mg.classList.remove("lvl2"); return; }
    var row = t.closest(".eb-mg-row");
    if (row) { var g = C[+row.getAttribute("data-i")]; showCards(g.n, g.c.map(card).join(""), "l1"); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });
  window.addEventListener("resize", function () { if (window.innerWidth > 991) closeAll(); });
})();
