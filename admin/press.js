/* Admin screen for the About page's "Media Presence" (As featured in) section. Everything
   lives in data/press.json; the About page reads that file when it loads (see
   /eb-press.js), so a mention saved here shows up there after the deploy the save starts. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, esc = EB.esc, ic = EB.ic;
  var P = "data/press.json";

  /* [key, label, type, required, extra] */
  var FIELDS = [
    ["name", "News website name", "text", true, { ph: "e.g. Zee News" }],
    ["logo", "Logo (until one is added, the name is shown instead)", "image"],
    ["url", "Link to the story", "text", false, { ph: "https://…" }],
    ["headline", "Story headline (optional)", "text", false, { ph: "The story's title, as the news website wrote it" }],
    ["date", "Date published (optional)", "date"]
  ];

  function newId() { return "pr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  EB.routes.press = function (main) {
    var data, newFile = false;
    main.innerHTML = EB.head("Press mentions",
      "The news websites shown under <b>Media Presence</b> on the <a href='/about#media-presence' target='_blank'>About page</a>. Add one, then click <b>Save changes</b>; it appears on the site after the next deploy (about a minute).",
      '<span class="u" id="pst"></span><a class="btn" href="/about#media-presence" target="_blank">' + ic("ext") + 'Preview</a><button class="btn primary" id="psv" disabled>Save changes</button>') +
      '<div id="pbody"><div class="card empty">Loading…</div></div>';

    function setDirty(v) { EB.setDirty(v); $("#psv").disabled = !v; $("#pst").innerHTML = v ? '<span class="dot"></span>Unsaved changes' : ""; }

    function draw() {
      var list = data.items;
      $("#pbody").innerHTML =
        '<div class="card" style="max-width:720px;margin-bottom:16px"><label class="f" for="p-total">Total news websites you have been featured on</label>' +
        '<input type="text" id="p-total" value="' + esc(data.total || "") + '" placeholder="e.g. 30+">' +
        '<p class="hint" style="margin:8px 0 0">Shown as “featured on 30+ news websites”. If it is higher than the number of mentions below, a “+N more” tile fills the gap.</p></div>' +
        '<div class="card tw"><div class="row" style="padding:14px 16px;border-bottom:1px solid var(--line)"><b>Mentions (' + list.length + ')</b>' +
        '<span class="u">Shown in this order.</span><div class="spacer"></div><button class="btn sm primary" id="padd">' + ic("plus") + "Add mention</button></div>" +
        '<table class="tbl"><tbody id="prows">' + (list.map(function (it, i) {
          var thumb = it.logo ? '<img src="' + esc(it.logo) + '" alt="" style="width:72px;height:36px;object-fit:contain;display:block">'
            : '<div style="width:72px;height:36px;border-radius:6px;background:var(--hover);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px">No logo</div>';
          var bits = [it.url ? "Has story link" : "No link yet", it.date || ""].filter(Boolean).join(" · ");
          return '<tr><td style="width:84px">' + thumb + '</td><td><div class="t">' + esc(it.name || "(no name)") + '</div><div class="u">' + esc(bits + (it.headline ? " · " + it.headline : "")) + "</div></td>" +
            '<td class="acts"><button class="btn sm" data-up="' + i + '"' + (i ? "" : " disabled") + ' aria-label="Move up">↑</button> <button class="btn sm" data-down="' + i + '"' + (i < list.length - 1 ? "" : " disabled") + ' aria-label="Move down">↓</button> ' +
            '<button class="btn sm" data-edit="' + i + '">Edit</button> <button class="btn sm danger" data-del="' + i + '" aria-label="Delete">' + ic("trash") + "</button></td></tr>";
        }).join("") || '<tr><td colspan="3" class="empty">No mentions yet. Click “Add mention”.</td></tr>') + "</tbody></table></div>";

      $("#p-total").addEventListener("input", function () { data.total = this.value.trim(); setDirty(true); });
      $("#padd").onclick = function () { edit(null); };
      $("#prows").onclick = function (e) {
        var b, i;
        if ((b = e.target.closest("[data-edit]"))) edit(+b.getAttribute("data-edit"));
        else if ((b = e.target.closest("[data-up]"))) { i = +b.getAttribute("data-up"); list.splice(i - 1, 0, list.splice(i, 1)[0]); setDirty(true); draw(); }
        else if ((b = e.target.closest("[data-down]"))) { i = +b.getAttribute("data-down"); list.splice(i + 1, 0, list.splice(i, 1)[0]); setDirty(true); draw(); }
        else if ((b = e.target.closest("[data-del]"))) {
          i = +b.getAttribute("data-del");
          EB.confirm("Delete <b>" + esc(list[i].name || "this mention") + "</b>?", "Delete", true).then(function (ok) { if (ok) { list.splice(i, 1); setDirty(true); draw(); } });
        }
      };
    }

    function fieldHtml(f, v) {
      var k = f[0], x = f[4] || {}, id = "pf-" + k;
      var lab = '<label class="f" for="' + id + '">' + esc(f[1]) + (f[3] ? " *" : "") + "</label>";
      if (f[2] === "image") return lab + '<img class="imgpv" id="pf-pv"' + (v ? ' src="' + esc(v) + '"' : " hidden") + ' alt="">' +
        '<div class="row" style="flex-wrap:nowrap"><input type="text" id="' + id + '" data-k="' + k + '" value="' + esc(v || "") + '" placeholder="/images/…">' +
        '<button type="button" class="btn sm" id="pf-pick">Choose / upload</button><button type="button" class="btn sm" id="pf-clear">Clear</button></div>';
      return lab + '<input type="' + (f[2] === "date" ? "date" : "text") + '" id="' + id + '" data-k="' + k + '" value="' + esc(v || "") + '"' + (x.ph ? ' placeholder="' + esc(x.ph) + '"' : "") + ">";
    }

    function edit(i) {
      var isNew = i === null, item = isNew ? {} : data.items[i];
      var m = EB.modal({ title: isNew ? "Add mention" : "Edit mention", body: FIELDS.map(function (f) { return fieldHtml(f, item[f[0]]); }).join(""),
        actions: [{ label: "Cancel" }, { label: isNew ? "Add" : "Done", primary: true, run: function (close, bd) {
          var out = {};
          FIELDS.forEach(function (f) { out[f[0]] = $('[data-k="' + f[0] + '"]', bd).value.trim(); });
          if (!out.name) throw new Error("Please fill in the news website name");
          if (out.url && !/^https?:\/\//.test(out.url)) throw new Error("The story link must start with https://");
          if (out.logo && !/^(\/(?!\/)|https:\/\/)/.test(out.logo)) throw new Error("The logo must be an image from the media library (starts with /) or an https:// link");
          if (isNew) { out.id = newId(); data.items.push(out); } else { Object.assign(item, out); }
          setDirty(true); draw();
        } }] });
      var bd = m.body, inp = $("#pf-logo", bd), pv = $("#pf-pv", bd);
      function preview() { var v = inp.value.trim(); pv.hidden = !v; if (v) pv.src = v; }
      inp.addEventListener("change", preview);
      $("#pf-pick", bd).onclick = function () { EB.pickMedia().then(function (u) { if (u) { inp.value = u; preview(); } }); };
      $("#pf-clear", bd).onclick = function () { inp.value = ""; preview(); };
    }

    $("#psv").onclick = function () {
      $("#psv").disabled = true;
      EB.writeFile(P, JSON.stringify(data, null, 2) + "\n", newFile, "Admin: edit press mentions")
        .then(function () { newFile = false; setDirty(false); EB.toast("Press mentions saved. The About page updates after the deploy finishes.", "ok"); })
        .catch(function (e) { $("#psv").disabled = false; EB.fail(e); });
    };

    return EB.readFile(P).then(function (t) { data = JSON.parse(t); }, function () { data = { total: "", items: [] }; newFile = true; })
      .then(function () { if (!Array.isArray(data.items)) data.items = []; draw(); });
  };
})();
