/* Student side of the examinations, on Vercel: https://www.ebuddha.in/api/exam

   Not switched on yet. Vercel has no permanent disk and caps uploads at 4.5 MB,
   and the GitHub repository is public, so papers and student videos need
   private file storage (for example Cloudflare R2, AWS S3 or Vercel Blob)
   before this can run online. _lib/exam.js holds the rules and works today on
   any server with a disk. */
"use strict";

module.exports = (req, res) => {
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ error: "Examinations are not available online yet. Please contact your mentor." }));
};
