/* Student login and profiles on Vercel: https://www.ebuddha.in/api/learner

   Not switched on yet, for the same reason as api/exam.js: student details and
   photos need private storage (a database), and the GitHub repository is
   public. _lib/learner.js holds the rules and works today on the local server.
   Until then the learner panel online keeps working without a login. */
"use strict";
module.exports = (req, res) => {
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ error: "Student login is not available online yet." }));
};
