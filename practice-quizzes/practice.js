/* Practice quizzes: one per course module, 20 questions each. Open to every
   student, no password or time limit, and they can be retaken. The questions
   come from data/practice-quizzes.json, which the admin panel edits, so this
   page needs no server of its own and can run on the live site. Answers are
   marked here in the browser, which is fine for practice but is why real exams
   are marked on the server instead. Best scores stay on the student's device. */
import { embedMode, esc, quizRunner, confirmSubmit, quizSummary, quizSolutions } from "/exams/quiz-ui.js";

const QUESTIONS = 20;
const EMBED = embedMode("practice");
const app = document.getElementById("app");
const $ = (s, r) => (r || document).querySelector(s);
let quizzes = [];

const bestKey = id => "eb-practice-best:" + id;
function readBest(id) { try { const v = localStorage.getItem(bestKey(id)); return v === null ? null : +v; } catch (e) { return null; } }
function saveBest(id, score) { try { localStorage.setItem(bestKey(id), String(score)); } catch (e) {} }
/* The student panel's Module progress list reads these two marks. */
function mark(kind, id) { try { localStorage.setItem("eb-practice-" + kind + ":" + id, String(Date.now())); } catch (e) {} }

function shell(inner) {
  return '<header class="top"><a href="/dashboard"><img src="/ebuddha-logo.svg" alt="eBuddha Digitech"></a><span class="spacer"></span><a class="btn sm" href="/dashboard#progress">Module progress</a><a class="btn sm" href="/exams">Examinations</a><a class="btn sm" href="/dashboard">Back to dashboard</a></header><main class="wrap">' + inner + "</main>";
}

function showList() {
  location.hash = "";
  app.innerHTML = shell('<div class="intro"><h1>Practice Quizzes</h1><p>One quiz for every course module, with ' + QUESTIONS + ' questions each. There is no time limit, and you can retake them as often as you like.</p><input type="search" class="search" id="find" placeholder="Search modules…" aria-label="Search modules"></div><section class="papers" id="list" aria-label="Quizzes"></section>');
  const draw = term => {
    const list = quizzes.filter(q => !term || q.title.toLowerCase().includes(term));
    $("#list").innerHTML = list.map(q => {
      const best = readBest(q.id);
      return '<article class="paper"><div class="row"><span class="no">Module ' + q.module + "</span>" + (best === null ? "" : '<span class="tag done">Best ' + best + "/" + QUESTIONS + "</span>") + "</div><h3>" + esc(q.title) + '</h3><p></p><div class="meta">' + QUESTIONS + ' questions</div><button class="btn primary" data-go="' + esc(q.id) + '">' + (best === null ? "Start quiz" : "Retake quiz") + "</button></article>";
    }).join("") || "<p>No modules match your search.</p>";
    $("#list").querySelectorAll("[data-go]").forEach(b => b.onclick = () => start(quizzes.find(q => q.id === b.dataset.go)));
  };
  $("#find").oninput = e => draw(e.target.value.trim().toLowerCase());
  draw("");
  scrollTo(0, 0);
}

function start(quiz) {
  location.hash = "quiz=" + quiz.id;
  mark("started", quiz.id);
  const answers = {}, began = Date.now(), attemptedAt = began;
  const ui = quizRunner(app, {
    questions: quiz.questions, answers, fullPage: true, submitLabel: "Submit Quiz",
    onSubmit: () => {
      const left = ui.total - ui.answered();
      confirmSubmit(left ? '<div class="note">' + left + " question" + (left === 1 ? " is" : "s are") + " unanswered. This module only counts as completed when you answer all " + ui.total + ".</div>" : "", async () => finish(quiz, answers, attemptedAt, Date.now() - began));
    }
  });
}

function finish(quiz, answers, attemptedAt, timeMs) {
  let correct = 0, wrong = 0;
  const grid = quiz.questions.map((q, n) => {
    const c = answers[String(n)];
    if (c === undefined) return "none";
    if (c === q.answer) { correct++; return "correct"; }
    wrong++; return "wrong";
  });
  const total = quiz.questions.length, prev = readBest(quiz.id);
  const best = prev === null ? correct : Math.max(prev, correct);
  saveBest(quiz.id, best);
  /* A later partial retake never takes a completed module back. */
  if (correct + wrong === total) mark("done", quiz.id);
  const solutions = quiz.questions.map((q, n) => ({ q: q.q, options: q.options, answer: q.answer, explain: q.explain, chosen: answers[String(n)] === undefined ? null : answers[String(n)] }));
  const header = '<header class="top"><a href="/dashboard"><img src="/ebuddha-logo.svg" alt="eBuddha Digitech"></a></header><div id="sm"></div>';
  const summary = () => {
    app.innerHTML = header;
    quizSummary($("#sm"), { title: "Module " + quiz.module + ": " + quiz.title, attemptedAt, timeMs, total, correct, wrong, unanswered: total - correct - wrong, grid, best }, [
      { label: "Go to Quizzes", run: showList },
      { label: "Module Progress", run: () => { location.href = "/dashboard#progress"; } },
      { label: "Retake Quiz", run: () => start(quiz) },
      { label: "View Solution", primary: true, run: () => { app.innerHTML = header; quizSolutions($("#sm"), quiz.title, solutions, summary); } }
    ]);
  };
  summary();
}

fetch("/data/practice-quizzes.json", { cache: "no-store" })
  .then(r => { if (!r.ok) throw new Error(); return r.json(); })
  .then(d => {
    /* A quiz still being written in the admin panel stays hidden until it has all its questions. */
    quizzes = (d.quizzes || []).filter(q => q.questions && q.questions.length === QUESTIONS).sort((a, b) => (a.module || 0) - (b.module || 0));
    const wanted = /^#quiz=(.+)$/.exec(location.hash), quiz = wanted && quizzes.find(q => q.id === wanted[1]);
    if (quiz) start(quiz); else showList();
  })
  .catch(() => { app.innerHTML = shell('<div class="done-card"><h1>Quizzes could not be loaded</h1><p>Please check your connection and try again.</p></div>'); });
