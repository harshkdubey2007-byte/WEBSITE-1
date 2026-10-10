/* The online admin panel's API: https://www.ebuddha.in/api/admin?route=...
   Files are read from and saved to GitHub (see _lib/github.js); the screens
   are the static files in /admin. */
"use strict";
const { createHandler } = require("./_lib/core");
const githubStore = require("./_lib/github");

/* Vercel caps a function's request body at 4.5 MB. */
module.exports = createHandler(() => githubStore(process.env), { uploadLimit: 4 * 1024 * 1024 });
