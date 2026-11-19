/* مصدر المزامنة: مستودع اللوحة التقليدية على GitHub — **قراءة فقط** (لا رمز كتابة، لا مزامنة عكسية).
   المستودع علني: الرأس من بروتوكول git الذكي (info/refs — لا يستهلك حصة API)، وقائمة الملفات وبصمات blobs من شجرة git (استدعاء واحد عند تغيّر الرأس)،
   والمحتوى من raw.githubusercontent.com مثبّتاً على SHA الالتزام (لا يتغيّر بين قراءتين). كل fetch محقون فيُختبَر بلا شبكة. */
export class GitHubSource {
  constructor({ repo, ref = "main", fetchFn = fetch, token = null }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("source: repo غير صالح"); this.repo = repo; this.ref = ref; this.f = fetchFn; this.token = token;
  }
  get hdr() { return { "User-Agent": "alyssum-beta-sync", Accept: "application/vnd.github+json", ...(this.token ? { Authorization: "Bearer " + this.token } : {}) }; }
  async json(url) { const r = await this.f(url, { headers: this.hdr }); if (r.status !== 200) throw new Error(`source: ${url.replace(/\?.*/, "")} → ${r.status}`); return r.json(); }
  /** SHA رأس المرجع (فرع) — بلا حصة API */
  async head() {
    const r = await this.f(`https://github.com/${this.repo}.git/info/refs?service=git-upload-pack`, { headers: { "User-Agent": "alyssum-beta-sync" } }); if (r.status !== 200) throw new Error("source: info/refs → " + r.status);
    const t = await r.text(), want = "refs/heads/" + this.ref; for (const line of t.split("\n")) { const i = line.indexOf(" " + want); if (i > 0 && /[0-9a-f]{40}$/.test(line.slice(0, i))) return line.slice(i - 40, i); }
    throw new Error("source: المرجع غير موجود " + this.ref);
  }
  /** Map(path → { blob, size }) لكل الملفات عند الالتزام */
  async tree(sha) {
    const j = await this.json(`https://api.github.com/repos/${this.repo}/git/trees/${sha}?recursive=1`); if (j.truncated) throw new Error("source: الشجرة مبتورة (أكبر من حدّ GitHub)");
    const m = new Map(); for (const e of j.tree) if (e.type === "blob") m.set(e.path, { blob: e.sha, size: e.size }); return m;
  }
  async bytes(sha, path) {
    const r = await this.f(`https://raw.githubusercontent.com/${this.repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: { "User-Agent": "alyssum-beta-sync" } }); if (r.status !== 200) throw new Error(`source: ${path} → ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  /** مقارنة نقطتين: { status: ahead|behind|identical|diverged, commits:[{sha,message,author}] } (قديم←جديد). للسجل وكشف التراجع/التفرّع فقط؛ التطبيق نفسه من حالة الشجرة */
  async compare(from, to) {
    if (!from || from === to) return { status: "identical", commits: [] };
    try { const j = await this.json(`https://api.github.com/repos/${this.repo}/compare/${from}...${to}`); return { status: j.status, commits: (j.commits ?? []).map((c) => ({ sha: c.sha, message: String(c.commit?.message ?? "").split("\n")[0].slice(0, 120), author: c.commit?.author?.name ?? "" })) }; } catch { return null; }
  }
}
