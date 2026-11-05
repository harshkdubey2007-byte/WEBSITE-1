/* Admin screen for the practice quizzes students see at /practice-quizzes. Each
   quiz has 20 questions and all of them live in data/practice-quizzes.json. The
   file is public (the student page reads it), which is fine for practice but is
   why exam papers are kept separately. */
(function () {
  "use strict";
  var EB = window.EB, $ = EB.$, esc = EB.esc, ic = EB.ic;
  var P = "data/practice-quizzes.json", NEEDED = 20;

  function load() {
    return EB.readFileOr(P, '{"quizzes":[]}').then(function (t) {
      var d = JSON.parse(t);
      return d.quizzes || [];
    });
  }
  function save(quizzes, message) {
    return EB.writeFile(P, JSON.stringify({ quizzes: quizzes }), false, message);
  }

  EB.routes.practice = function (main, params) {
    var id = params.get("id");
    return id ? edit(main, id) : list(main);
  };

  function list(main) {
    main.innerHTML = EB.head("Practice quizzes", "One quiz per course module, " + NEEDED + " questions each. Students can take them any time, with no password.", '<a class="btn" target="_blank" href="/practice-quizzes">' + ic("ext") + 'Student view</a><a class="btn primary" href="#/practice?id=new">' + ic("plus") + "New quiz</a>") +
      '<input type="search" id="pf" placeholder="Search quizzes…" style="max-width:320px;margin-bottom:14px"><div class="card tw"><table class="tbl"><thead><tr><th>Module</th><th>Quiz</th><th>Questions</th><th></th></tr></thead><tbody id="pb"><tr><td colspan="4" class="empty">Loading…</td></tr></tbody></table></div>';
    return load().then(function (quizzes) {
      function draw(term) {
        var rows = quizzes.filter(function (q) { return !term || q.title.toLowerCase().indexOf(term) > -1; });
        $("#pb").innerHTML = rows.map(function (q) {
          var n = q.questions.length;
          return "<tr><td>" + esc(q.module) + '</td><td><div class="t"><a href="#/practice?id=' + encodeURIComponent(q.id) + '" style="color:inherit">' + esc(q.title) + "</a></div></td><td>" + (n === NEEDED ? n : '<span class="badge amber" style="text-transform:none">' + n + " of " + NEEDED + ", hidden from students</span>") + '</td><td class="acts"><a class="btn sm" href="#/practice?id=' + encodeURIComponent(q.id) + '">Edit</a> <button class="btn sm danger" data-d="' + esc(q.id) + '" aria-label="Delete ' + esc(q.title) + '">' + ic("trash") + "</button></td></tr>";
        }).join("") || '<tr><td colspan="4" class="empty">No quizzes found</td></tr>';
      }
      draw("");
      $("#pf").oninput = function () { draw(this.value.trim().toLowerCase()); };
      $("#pb").onclick = function (e) {
        var b = e.target.closest("[data-d]");
        if (!b) return;
        var q = quizzes.find(function (x) { return x.id === b.getAttribute("data-d"); });
        EB.confirm("Delete the quiz <b>" + esc(q.title) + "</b> and its questions?", "Delete", true).then(function (ok) {
          if (!ok) return;
          quizzes = quizzes.filter(function (x) { return x !== q; });
          save(quizzes, "Admin: delete practice quiz " + q.title).then(function () { EB.toast("Quiz deleted", "ok"); draw($("#pf").value.trim().toLowerCase()); }).catch(EB.fail);
        });
      };
    }).catch(function (e) { $("#pb").innerHTML = '<tr><td colspan="4" class="empty">' + esc(e.message) + "</td></tr>"; });
  }

  function edit(main, id) {
    main.innerHTML = EB.head(id === "new" ? "New practice quiz" : "Edit practice quiz", "", '<a class="btn" href="#/practice">All quizzes</a><button class="btn primary" id="qs">Save quiz</button>') + '<div id="qb"><p class="u">Loading…</p></div>';
    return load().then(function (quizzes) {
      var quiz = id === "new" ? { id: "q" + Date.now().toString(36), module: quizzes.reduce(function (m, q) { return Math.max(m, q.module || 0); }, 0) + 1, title: "", questions: [] }
        : quizzes.find(function (q) { return q.id === id; });
      if (!quiz) { $("#qb").innerHTML = '<div class="card"><p class="hint">That quiz no longer exists.</p></div>'; return; }
      $("#qb").innerHTML = '<div class="card"><div class="grid2"><div><label class="f">Quiz title</label><input type="text" id="qt" maxlength="120" value="' + esc(quiz.title) + '"></div><div><label class="f">Module number (sets the order)</label><input type="number" id="qm" min="1" value="' + esc(quiz.module) + '"></div></div></div><div class="card"><h2>Questions</h2><div id="qe"></div></div>';
      var editor = EB.questionEditor($("#qe"), quiz.questions, { exact: NEEDED });
      $("#qs").onclick = function () {
        var title = $("#qt").value.trim();
        try {
          if (!title) throw new Error("Give the quiz a title");
          var questions = editor.get();
          if (questions.length > NEEDED) throw new Error("A practice quiz has " + NEEDED + " questions. This one has " + questions.length + ".");
          quiz.title = title; quiz.module = +$("#qm").value || quiz.module; quiz.questions = questions;
        } catch (e) { EB.fail(e); return; }
        if (id === "new") quizzes.push(quiz);
        quizzes.sort(function (a, b) { return (a.module || 0) - (b.module || 0); });
        save(quizzes, "Admin: edit practice quiz " + title).then(function () {
          EB.toast(questions.length === NEEDED ? "Quiz saved" : "Saved. Students see it once it has " + NEEDED + " questions.", "ok");
          if (id === "new") EB.go("practice", { id: quiz.id });
        }).catch(EB.fail);
      };
    }).catch(function (e) { $("#qb").innerHTML = '<div class="card"><p class="hint">' + esc(e.message) + "</p></div>"; });
  }
})();
