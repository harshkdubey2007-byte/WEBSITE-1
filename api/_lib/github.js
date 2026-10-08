/* Store for the online admin: reads and writes the website's files in its
   GitHub repository. Every save is one commit on the live branch, and
   Vercel deploys each commit, so a save goes live in about a minute.
   Earlier versions, the activity log and the trash all come from git history.

   Environment variables (Vercel → Project → Settings → Environment Variables):
     ADMIN_PASSWORD   password for /admin
     GITHUB_TOKEN     fine-grained token with "Contents: read and write" on the repo
     GITHUB_REPO      owner/name   (default harshkdubey2007-byte/WEBSITE-1)
     GITHUB_BRANCH    branch that deploys to production (default main)
     VERCEL_PROJECT   project whose deploy status to show (default website-1) */
"use strict";
const crypto = require("crypto");
const { httpError } = require("./core");

module.exports = function githubStore(env) {
  const token = env.GITHUB_TOKEN || "";
  const repo = env.GITHUB_REPO || "harshkdubey2007-byte/WEBSITE-1";
  const branch = env.GITHUB_BRANCH || "main";
  const project = (env.VERCEL_PROJECT || "website-1").toLowerCase();
  const API = env.GITHUB_API || "https://api.github.com";
  const R = "/repos/" + repo;
  const enc = p => p.split("/").map(encodeURIComponent).join("/");

  async function call(method, path, body, raw) {
    const r = await fetch(API + path, {
      method,
      headers: Object.assign({ Authorization: "Bearer " + token, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "ebuddha-admin" }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 404 && method === "GET") return null;
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      if (r.status === 401) throw httpError(502, "GitHub rejected the token. Check GITHUB_TOKEN in Vercel.");
      if (r.status === 403 && /rate limit/i.test(t)) throw httpError(503, "GitHub's rate limit was reached. Try again in a few minutes.");
      if (r.status === 403 || r.status === 404) throw httpError(502, "The GitHub token can't write to " + repo + ". Give it Contents: read and write on that repo.");
      const e = httpError(r.status === 422 || r.status === 409 ? 409 : 502, "GitHub error " + r.status + ": " + t.slice(0, 200));
      e.github = r.status; throw e;
    }
    return raw ? Buffer.from(await r.arrayBuffer()) : r.status === 204 ? null : r.json();
  }

  const pw = env.ADMIN_PASSWORD || "";
  const missing = [!pw && "ADMIN_PASSWORD", !token && "GITHUB_TOKEN"].filter(Boolean);
  const digest = s => crypto.createHash("sha256").update(s).digest();

  let tree = null;
  const blobCache = new Map();
  const when = c => Date.parse((c.commit.committer || c.commit.author).date);
  const commits = (extra, n) => call("GET", R + "/commits?sha=" + encodeURIComponent(branch) + "&per_page=" + (n || 50) + (extra || ""));

  async function deployState(sha) {
    const s = await call("GET", R + "/commits/" + sha + "/status");
    const list = (s && s.statuses) || [];
    const v = list.find(x => x.context.toLowerCase().includes(project)) || list.find(x => /vercel/i.test(x.context));
    if (!v) return { state: "waiting" };
    return { state: v.state === "success" ? "live" : v.state === "pending" ? "deploying" : "failed", url: v.target_url };
  }

  return {
    name: "github",
    label: repo + " (" + branch + ")",
    auth: {
      configured: missing.length === 0,
      missing,
      secret: "eb-admin|" + pw + "|" + token,
      check: async p => crypto.timingSafeEqual(digest(p), digest(pw))
    },

    async read(p) { const b = await this.readBuffer(p); return b == null ? null : b.toString("utf8"); },
    async readBuffer(p) {
      const f = tree && tree.find(x => x.path === p);
      if (f && blobCache.has(f.sha)) return blobCache.get(f.sha);
      const b = f ? await call("GET", R + "/git/blobs/" + f.sha, null, true) : await call("GET", R + "/contents/" + enc(p) + "?ref=" + encodeURIComponent(branch), null, true);
      if (f && b) blobCache.set(f.sha, b);
      return b;
    },
    async list() {
      if (tree) return tree;
      const t = await call("GET", R + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1");
      if (!t) throw httpError(502, "Branch " + branch + " was not found in " + repo);
      tree = t.tree.filter(e => e.type === "blob").map(e => ({ path: e.path, size: e.size, sha: e.sha }));
      return tree;
    },

    /* One commit for all changes. If someone else committed in between, start
       again from the new head (their files are kept; ours overwrite only the
       paths we change). */
    async commit(changes, message) {
      const entries = [];
      for (const c of changes) {
        if (c.sha) entries.push({ path: c.path, mode: "100644", type: "blob", sha: c.sha });
        else if (c.content === null) entries.push({ path: c.path, mode: "100644", type: "blob", sha: null });
        else if (Buffer.isBuffer(c.content)) {
          const b = await call("POST", R + "/git/blobs", { content: c.content.toString("base64"), encoding: "base64" });
          entries.push({ path: c.path, mode: "100644", type: "blob", sha: b.sha });
        } else entries.push({ path: c.path, mode: "100644", type: "blob", content: c.content });
      }
      for (let attempt = 0; ; attempt++) {
        const ref = await call("GET", R + "/git/ref/heads/" + encodeURIComponent(branch));
        const head = ref.object.sha;
        const hc = await call("GET", R + "/git/commits/" + head);
        const nt = await call("POST", R + "/git/trees", { base_tree: hc.tree.sha, tree: entries });
        const nc = await call("POST", R + "/git/commits", { message, tree: nt.sha, parents: [head] });
        try {
          await call("PATCH", R + "/git/refs/heads/" + encodeURIComponent(branch), { sha: nc.sha, force: false });
          tree = null;
          return { id: nc.sha };
        } catch (e) { if (e.github !== 422 || attempt >= 2) throw e; }
      }
    },

    async history(p) {
      const list = (await commits("&path=" + encodeURIComponent(p), 40)) || [];
      return list.map(c => ({ id: c.sha, t: when(c), message: c.commit.message.split("\n")[0], author: c.commit.author.name }));
    },
    async readAt(p, id) {
      if (!/^[a-f0-9]{7,40}$/.test(id || "")) return null;
      const b = await call("GET", R + "/contents/" + enc(p) + "?ref=" + id, null, true);
      return b ? b.toString("utf8") : null;
    },
    async log() {
      return ((await commits("", 60)) || []).map(c => {
        const msg = c.commit.message.split("\n")[0], m = /^Admin: (\w+) (.+)$/.exec(msg);
        return { t: when(c), id: c.sha, message: msg, action: m ? m[1] : "commit", path: m ? m[2] : "", author: c.commit.author.name };
      });
    },
    async trash() {
      return ((await commits("", 100)) || []).filter(c => /^Admin: delete /.test(c.commit.message))
        .map(c => ({ id: c.sha + "|" + c.commit.message.split("\n")[0].replace(/^Admin: delete /, ""), path: c.commit.message.split("\n")[0].replace(/^Admin: delete /, ""), t: when(c) }));
    },
    /* Put deleted files back by pointing at their blobs in the commit before the delete. */
    async untrash(id) {
      const [sha, p] = String(id || "").split("|");
      if (!/^[a-f0-9]{40}$/.test(sha) || !p) throw httpError(400, "Unknown trash item");
      const c = await call("GET", R + "/git/commits/" + sha);
      const parent = c && c.parents[0];
      if (!parent) throw httpError(404, "That delete can't be found any more");
      const pc = await call("GET", R + "/git/commits/" + parent.sha);
      const t = await call("GET", R + "/git/trees/" + pc.tree.sha + "?recursive=1");
      const hit = t.tree.filter(e => e.type === "blob" && (e.path === p || e.path.startsWith(p + "/")));
      if (!hit.length) throw httpError(404, "Nothing to restore");
      return this.commit(hit.map(e => ({ path: e.path, sha: e.sha })), "Admin: restore " + p);
    },

    async overview() {
      const c = ((await commits("", 1)) || [])[0];
      if (!c) return null;
      return { last: { id: c.sha, t: when(c), message: c.commit.message.split("\n")[0] }, deploy: await deployState(c.sha) };
    },
    routes: {
      "deploy-status": async ({ q }) => {
        const id = q("id");
        if (!/^[a-f0-9]{40}$/.test(id || "")) throw httpError(400, "Bad id");
        return deployState(id);
      },
      deploys: async () => {
        const list = ((await commits("", 10)) || []);
        return Promise.all(list.map(async c => Object.assign({ id: c.sha, t: when(c), message: c.commit.message.split("\n")[0] }, await deployState(c.sha).catch(() => ({ state: "unknown" })))));
      }
    }
  };
};
