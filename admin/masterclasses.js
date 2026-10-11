/* Admin screen for the home page's Free Masterclasses section. Every session lives in
   data/masterclasses.json; the home page reads that file when it loads (see
   /eb-masterclass.js), so a session saved here shows up there after the deploy that the
   save starts. Sessions with a photo also appear in the "live" grid (up to four). */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, esc = EB.esc, ic = EB.ic;
  var P = "data/masterclasses.json";
  var GRID_MAX = 4;
  var TYPES = [["Live Masterclass", "Live Masterclass"], ["Live Workshop", "Live Workshop"]];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* [key, label, type, required, extra] */
  var FIELDS = [
    ["type", "Session type", "select", true, { options: TYPES }],
    ["title", "Title", "text", true, { ph: "e.g. SEO in the Age of AI Search" }],
    ["date", "Date", "date", true],
    ["time", "Start time (India time)", "time", true],
    ["duration", "Duration (minutes)", "number", true, { min: 15 }],
    ["mentor", "Mentor", "text", false, { ph: "e.g. SEO Mentor" }],
    ["image", "Photo (sessions with a photo appear in the home page's live grid)", "image"],
    ["link", "Register link", "text", false, { ph: "/events" }]
  ];

  function startOf(s) { return Date.parse(s.date + "T" + (s.time || "00:00") + ":00+05:30"); }
  function endOf(s) { return startOf(s) + (+s.duration || 60) * 60000; }
  function when(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || "")) return "No date";
    var d = s.date.split("-"), t = String(s.time || "00:00").split(":"), h = +t[0];
    var wd = DAY[new Date(Date.UTC(+d[0], +d[1] - 1, +d[2])).getUTCDay()];
    return wd + " " + +d[2] + " " + MON[+d[1] - 1] + " " + d[0] + " · " + (h % 12 || 12) + ":" + (t[1] || "00") + " " + (h < 12 ? "AM" : "PM") + " IST · " + (+s.duration || 60) + " min";
  }
  function byDate(a, b) { return (startOf(a) || 0) - (startOf(b) || 0); }
  function newId() { return "mc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  /* Which upcoming sessions the home page's grid will show (same rule as eb-masterclass.js). */
  function gridIds(list) {
    var now = Date.now();
    return list.filter(function (s) { return s.image && endOf(s) > now; }).sort(byDate).slice(0, GRID_MAX).map(function (s) { return s.id; });
  }

  EB.routes.masterclasses = function (main) {
    var data, dirty = false, newFile = false;
    main.innerHTML = EB.head("Masterclasses",
      "Free sessions shown on the <a href='/#free-masterclasses' target='_blank'>home page</a>. Add a session and click <b>Save changes</b>; it appears on the site after the next deploy (about a minute). " +
      "Sessions with a <b>photo</b> also appear in the live grid (the next " + GRID_MAX + "). Ended sessions hide themselves.",
      '<span class="u" id="mst"></span><a class="btn" href="/#free-masterclasses" target="_blank">' + ic("ext") + 'Preview</a><button class="btn primary" id="msv" disabled>Save changes</button>') +
      '<div id="mbody"><div class="card empty">Loading…</div></div>';

    function setDirty(v) { dirty = v; EB.setDirty(v); $("#msv").disabled = !v; $("#mst").innerHTML = v ? '<span class="dot"></span>Unsaved changes' : ""; }

    function draw() {
      var list = data.sessions, now = Date.now(), grid = gridIds(list);
      var ended = list.filter(function (s) { return endOf(s) <= now; }).length;
      list.sort(byDate);
      $("#mbody").innerHTML = '<div class="card tw"><div class="row" style="padding:14px 16px;border-bottom:1px solid var(--line)"><b>Sessions (' + list.length + ')</b>' +
        '<span class="u">' + grid.length + " in the live grid · " + (list.length - ended) + " upcoming" + (ended ? " · " + ended + " ended" : "") + "</span><div class=\"spacer\"></div>" +
        (ended ? '<button class="btn sm" id="mclean">Remove ended</button>' : "") +
        '<button class="btn sm primary" id="madd">' + ic("plus") + "Add session</button></div>" +
        '<table class="tbl"><tbody id="mrows">' + (list.map(function (s, i) {
          var over = endOf(s) <= now, on = grid.indexOf(s.id) > -1;
          var badge = over ? '<span class="badge">Ended</span>' : on ? '<span class="badge green">In live grid</span>' : '<span class="badge blue">Upcoming</span>';
          var thumb = s.image ? '<img src="' + esc(s.image) + '" alt="" style="width:64px;height:44px;object-fit:cover;border-radius:8px;display:block">'
            : '<div style="width:64px;height:44px;border-radius:8px;background:var(--hover);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px">No photo</div>';
          return '<tr data-i="' + i + '"' + (over ? ' style="opacity:.55"' : "") + '><td style="width:76px">' + thumb + '</td><td><div class="t">' + esc(s.title || "(untitled)") + " " + badge + '</div>' +
            '<div class="u">' + esc((s.type || "Live Masterclass") + " · " + when(s) + (s.mentor ? " · " + s.mentor : "")) + "</div></td>" +
            '<td class="acts"><button class="btn sm" data-edit="' + i + '">Edit</button> <button class="btn sm" data-dup="' + i + '">Duplicate</button> <button class="btn sm danger" data-del="' + i + '" aria-label="Delete">' + ic("trash") + "</button></td></tr>";
        }).join("") || '<tr><td colspan="3" class="empty">No sessions yet. Click “Add session”.</td></tr>') + "</tbody></table></div>";

      $("#madd").onclick = function () { edit(null); };
      if ($("#mclean")) $("#mclean").onclick = function () {
        EB.confirm("Remove the " + ended + " ended session" + (ended > 1 ? "s" : "") + " from the list?", "Remove").then(function (ok) {
          if (!ok) return;
          data.sessions = list.filter(function (s) { return endOf(s) > Date.now(); }); setDirty(true); draw();
        });
      };
      $("#mrows").onclick = function (e) {
        var b, i;
        if ((b = e.target.closest("[data-edit]"))) edit(+b.getAttribute("data-edit"));
        else if ((b = e.target.closest("[data-dup]"))) { var c = JSON.parse(JSON.stringify(list[+b.getAttribute("data-dup")])); c.id = newId(); c.title = c.title + " (copy)"; list.push(c); setDirty(true); draw(); }
        else if ((b = e.target.closest("[data-del]"))) {
          i = +b.getAttribute("data-del");
          EB.confirm("Delete <b>" + esc(list[i].title || "this session") + "</b>?", "Delete", true).then(function (ok) { if (ok) { list.splice(i, 1); setDirty(true); draw(); } });
        }
      };
    }

    function fieldHtml(f, v) {
      var k = f[0], type = f[2], x = f[4] || {}, id = "mf-" + k;
      var lab = '<label class="f" for="' + id + '">' + esc(f[1]) + (f[3] ? " *" : "") + "</label>";
      var ph = x.ph ? ' placeholder="' + esc(x.ph) + '"' : "";
      if (type === "select") return lab + '<select id="' + id + '" data-k="' + k + '">' + x.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
      if (type === "image") return lab + '<img class="imgpv" id="mf-pv"' + (v ? ' src="' + esc(v) + '"' : " hidden") + ' alt="">' +
        '<div class="row" style="flex-wrap:nowrap"><input type="text" id="' + id + '" data-k="' + k + '" value="' + esc(v || "") + '" placeholder="/images/… (leave empty to keep it out of the grid)">' +
        '<button type="button" class="btn sm" id="mf-pick">Choose / upload</button><button type="button" class="btn sm" id="mf-clear">Clear</button></div>';
      var t = { number: "number", date: "date", time: "time" }[type] || "text";
      return lab + '<input type="' + t + '" id="' + id + '" data-k="' + k + '" value="' + esc(v == null ? "" : v) + '"' + ph + (x.min != null ? ' min="' + x.min + '"' : "") + ">";
    }

    function edit(i) {
      var isNew = i === null, item = isNew ? { type: "Live Masterclass", duration: 90, link: "/events" } : data.sessions[i];
      var m = EB.modal({ title: isNew ? "Add session" : "Edit session", body: FIELDS.map(function (f) { return fieldHtml(f, item[f[0]]); }).join(""),
        actions: [{ label: "Cancel" }, { label: isNew ? "Add" : "Done", primary: true, run: function (close, bd) {
          var missing = FIELDS.filter(function (f) { return f[3] && !$('[data-k="' + f[0] + '"]', bd).value.trim(); }).map(function (f) { return f[1]; });
          if (missing.length) throw new Error("Please fill in: " + missing.join(", "));
          var out = isNew ? { id: newId() } : item;
          FIELDS.forEach(function (f) {
            var v = $('[data-k="' + f[0] + '"]', bd).value.trim();
            out[f[0]] = f[2] === "number" ? Math.max(15, +v || 60) : v;
          });
          if (out.link && !/^(\/(?!\/)|https:\/\/)/.test(out.link)) throw new Error("The register link must start with / or https://");
          if (out.image && !/^(\/(?!\/)|https:\/\/)/.test(out.image)) throw new Error("The photo must be an image from the media library (starts with /) or an https:// link");
          if (!out.link) out.link = "/events";
          if (isNew) data.sessions.push(out);
          setDirty(true); draw();
        } }] });
      var bd = m.body, inp = $("#mf-image", bd), pv = $("#mf-pv", bd);
      function preview() { var v = inp.value.trim(); pv.hidden = !v; if (v) pv.src = v; }
      inp.addEventListener("change", preview);
      $("#mf-pick", bd).onclick = function () { EB.pickMedia().then(function (u) { if (u) { inp.value = u; preview(); } }); };
      $("#mf-clear", bd).onclick = function () { inp.value = ""; preview(); };
    }

    $("#msv").onclick = function () {
      $("#msv").disabled = true;
      data.sessions.sort(byDate);
      EB.writeFile(P, JSON.stringify(data, null, 2) + "\n", newFile, "Admin: edit masterclasses")
        .then(function () { newFile = false; setDirty(false); EB.toast("Masterclasses saved. The home page updates after the deploy finishes.", "ok"); })
        .catch(function (e) { $("#msv").disabled = false; EB.fail(e); });
    };

    return EB.readFile(P).then(function (t) { data = JSON.parse(t); }, function () { data = { sessions: [] }; newFile = true; })
      .then(function () { if (!Array.isArray(data.sessions)) data.sessions = []; draw(); });
  };
})();
