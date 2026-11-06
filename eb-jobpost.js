/* Hire From Us: "Post a job" form (#post-job). The job goes live in the learner
   panel's Career & jobs (api/learner?route=job-post). If that is not available
   (the live site today), the details are sent to eBuddha on WhatsApp instead. */
(function () {
  "use strict";
  function init() {
    if (document.getElementById("post-job")) return;
    var css = "#post-job{padding:64px 16px;background:linear-gradient(180deg,#F4F7FF,#fff)}#post-job .pj{max-width:880px;margin:0 auto;background:#fff;border:1px solid #E3E8F5;border-radius:22px;padding:30px;box-shadow:0 24px 50px -30px rgba(0,30,140,.35)}" +
      "#post-job h2{margin:0 0 6px;font:700 30px/1.2 Poppins,sans-serif;color:#0F172A}#post-job h2 span{color:#194CFF}#post-job p.s{margin:0 0 22px;color:#475569}#post-job .g{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}#post-job .f{grid-column:1/-1}" +
      "#post-job label{display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:6px}#post-job input,#post-job select,#post-job textarea{width:100%;box-sizing:border-box;border:1px solid #D7DCE6;border-radius:11px;padding:11px 12px;font:inherit;font-size:14.5px;background:#fff;outline:none}#post-job textarea{min-height:96px;resize:vertical}" +
      "#post-job input:focus,#post-job select:focus,#post-job textarea:focus{border-color:#2F5BFF;box-shadow:0 0 0 3px rgba(47,91,255,.14)}#post-job button{margin-top:18px;height:50px;padding:0 28px;border:0;border-radius:13px;background:linear-gradient(180deg,#FFD27A,#FDBD56);color:#111827;font:600 16px Poppins,sans-serif;cursor:pointer}" +
      "#post-job .m{margin:12px 0 0;font-size:14px;min-height:20px}#post-job .hp{position:absolute;left:-9999px}@media(max-width:640px){#post-job .g{grid-template-columns:1fr}#post-job h2{font-size:24px}#post-job .pj{padding:22px}#post-job button{width:100%}}";
    var f = function (n, l, t, ph, full, req) { return '<div' + (full ? ' class="f"' : "") + '><label for="pj-' + n + '">' + l + (req ? " *" : "") + "</label>" + (t === "ta" ? '<textarea id="pj-' + n + '" name="' + n + '" placeholder="' + ph + '"' + (req ? " required" : "") + "></textarea>" : '<input id="pj-' + n + '" name="' + n + '" type="' + t + '" placeholder="' + ph + '"' + (req ? " required" : "") + ">") + "</div>"; };
    var sec = document.createElement("section"); sec.id = "post-job";
    sec.innerHTML = "<style>" + css + '</style><div class="pj"><h2>Post a job for <span>eBuddha learners</span></h2><p class="s">Hiring digital marketers, SEO, social media or developers? Your opening goes live in our learner panel for trained students.</p><form novalidate><div class="g">' +
      f("company", "Company name", "text", "e.g. ACME Digital", 0, 1) + f("role", "Job role", "text", "e.g. SEO Executive", 0, 1) + f("location", "Location", "text", "e.g. Bhopal · On-site / Remote", 0, 1) +
      '<div><label for="pj-type">Job type *</label><select id="pj-type" name="type"><option>Full-time</option><option>Internship</option><option>Part-time</option><option>Freelance</option><option>Contract</option></select></div>' +
      f("salary", "Salary / stipend", "text", "e.g. ₹15,000–25,000 per month") + f("apply", "Apply link or email", "text", "careers page or hr@company.com", 0, 1) +
      f("desc", "Job description", "ta", "Responsibilities, skills and experience you need", 1, 1) + f("contact", "Your name", "text", "Hiring contact", 0, 1) + f("phone", "Your phone", "tel", "+91", 0, 1) + f("email", "Your email", "email", "you@company.com", 1) +
      '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"></div><button type="submit">Post job</button><p class="m" role="status"></p></form></div>';
    var footer = document.querySelector(".footer-section") || document.querySelector("footer");
    (footer && footer.parentNode ? footer.parentNode : document.body).insertBefore(sec, footer || null);
    var form = sec.querySelector("form"), msg = sec.querySelector(".m");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = {}; new FormData(form).forEach(function (v, k) { d[k] = String(v).trim(); });
      if (!d.company || !d.role || !d.location || !d.desc || !d.contact || !d.phone || !d.apply) { msg.style.color = "#DC2626"; msg.textContent = "Please fill all fields marked *."; return; }
      var btn = form.querySelector("button"); btn.disabled = true; msg.style.color = "#475569"; msg.textContent = "Posting…";
      fetch("/api/learner?route=job-post", { method: "POST", headers: { "Content-Type": "application/json", "x-eb-learner": "1" }, body: JSON.stringify(d) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok) { form.reset(); msg.style.color = "#15803D"; msg.textContent = "Thank you! Your job is now live for eBuddha learners."; return; }
          if (r.status === 400 || r.status === 429) throw new Error(j.error);
          throw 0;
        });
      }).catch(function (err) {
        if (err && err.message) { msg.style.color = "#DC2626"; msg.textContent = err.message; return; }
        var text = "*New job post*\nCompany: " + d.company + "\nRole: " + d.role + "\nLocation: " + d.location + "\nType: " + d.type + (d.salary ? "\nSalary: " + d.salary : "") + "\nApply: " + d.apply + "\n\n" + d.desc + "\n\nContact: " + d.contact + ", " + d.phone + (d.email ? ", " + d.email : "");
        window.open("https://wa.me/918461958162?text=" + encodeURIComponent(text), "_blank", "noopener");
        msg.style.color = "#15803D"; msg.textContent = "WhatsApp has opened with your job details. Press Send and our team will publish it.";
      }).then(function () { btn.disabled = false; });
    });
    if (location.hash === "#post-job") sec.scrollIntoView();
  }
  /* after the page has finished loading, so the React page is never disturbed */
  if (document.readyState === "complete") setTimeout(init, 300); else window.addEventListener("load", function () { setTimeout(init, 300); });
})();
