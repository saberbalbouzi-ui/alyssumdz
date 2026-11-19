/* مصدر المزامنة: مستودع اللوحة التقليدية على GitHub — **قراءة فقط** (لا رمز كتابة، لا مزامنة عكسية).
   المستودع علني: الرأس من بروتوكول git الذكي (info/refs — لا يستهلك حصة API)، وقائمة الملفات وبصمات blobs من شجرة git (استدعاء واحد عند تغيّر الرأس)،
   والمحتوى من raw.githubusercontent.com مثبّتاً على SHA الالتزام (لا يتغيّر بين قراءتين). كل fetch محقون فيُختبَر بلا شبكة. */
export class GitHubSource {
  constructor({ repo, ref = "main", fetchFn = fetch, token = null }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("source: repo غير صالح"); this.repo = repo; this.ref = ref; this.f = (...a) => fetchFn(...a);   /* لا تُستدعى fetch الأصلية بـthis مختلف في Workers (Illegal invocation) */ this.token = token;
  }
  get hdr() { return { "User-Agent": "alyssum-beta-sync", Accept: "application/vnd.github+json", ...(this.token ? { Authorization: "Bearer " + this.token } : {}) }; }
  /** خطأ مصدر بحالة HTTP (403/429 = حدّ معدّل GitHub لعناوين Cloudflare المشتركة ← تراجع بدل الإلحاح) */
  err(url, status, r) { const e = new Error(`source: ${url.replace(/\?.*/, "")} → ${status}`); e.status = status; const ra = Number(r?.headers?.get?.("retry-after")), rs = Number(r?.headers?.get?.("x-ratelimit-reset")); e.retryAfterMs = ra > 0 ? ra * 1000 : rs > 0 ? Math.max(0, rs * 1000 - Date.now()) : null; return e; }
  async json(url) { const r = await this.f(url, { headers: this.hdr }); if (r.status !== 200) throw this.err(url, r.status, r); return r.json(); }
  /** SHA رأس المرجع — سلسلة مصادر بدلاء (حصص مستقلة عند حدّ المعدّل): 1) بروتوكول git الذكي info/refs 2) خلاصة Atom للالتزامات 3) API. أول نجاح يكفي؛ إن فشلت كلها يُرفع آخر خطأ (⇒ تراجع). */
  async head() {
    const errs = [], want = "refs/heads/" + this.ref, auth = this.token ? { Authorization: "Basic " + btoa("x-access-token:" + this.token) } : {};
    try {
      const r = await this.f(`https://github.com/${this.repo}.git/info/refs?service=git-upload-pack`, { headers: { "User-Agent": "alyssum-beta-sync", ...auth } }); if (r.status !== 200) throw this.err("info/refs", r.status, r);
      const t = await r.text(); for (const line of t.split("\n")) { const i = line.indexOf(" " + want); if (i > 0 && /[0-9a-f]{40}$/.test(line.slice(0, i))) return line.slice(i - 40, i); } throw new Error("source: المرجع غير موجود " + this.ref);
    } catch (e) { if (!e.status) throw e; errs.push(e); }
    try {
      const r = await this.f(`https://github.com/${this.repo}/commits/${this.ref.split("/").map(encodeURIComponent).join("/")}.atom`, { headers: { "User-Agent": "alyssum-beta-sync" } }); if (r.status !== 200) throw this.err("commits.atom", r.status, r);
      const m = (await r.text()).match(/Commit\/([0-9a-f]{40})/); if (m) return m[1]; throw new Error("source: atom بلا التزام");
    } catch (e) { if (!e.status && !/atom/.test(e.message)) throw e; errs.push(e); }
    try { const j = await this.json(`https://api.github.com/repos/${this.repo}/git/ref/heads/${this.ref.split("/").map(encodeURIComponent).join("/")}`); if (/^[0-9a-f]{40}$/.test(j?.object?.sha ?? "")) return j.object.sha; throw new Error("source: ref بلا sha"); } catch (e) { if (!e.status && !/ref/.test(e.message)) throw e; errs.push(e); }
    const lim = errs.find((e) => e.status === 403 || e.status === 429) ?? errs.at(-1); throw lim;
  }
  /** Map(path → { blob, size }) لكل الملفات عند الالتزام */
  async tree(sha) {
    const j = await this.json(`https://api.github.com/repos/${this.repo}/git/trees/${sha}?recursive=1`); if (j.truncated) throw new Error("source: الشجرة مبتورة (أكبر من حدّ GitHub)");
    const m = new Map(); for (const e of j.tree) if (e.type === "blob") m.set(e.path, { blob: e.sha, size: e.size }); return m;
  }
  async bytes(sha, path) {
    const r = await this.f(`https://raw.githubusercontent.com/${this.repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: { "User-Agent": "alyssum-beta-sync" } }); if (r.status !== 200) throw this.err(path, r.status, r);
    return new Uint8Array(await r.arrayBuffer());
  }
  /** تغييرات بين التزامين من نقطة الويب `compare/<from>...<to>.diff` (ليست API: لا حصة REST المشتركة). يعيد Map(مسار → "A"|"M"|"D")، أو null إن تعذّر التحليل بأمان (مسار مقتبَس/غير ASCII، أو diff كبير) ⇒ يعود المحرّك لشجرة git. */
  async delta(from, to) {
    const url = `https://github.com/${this.repo}/compare/${from}...${to}.diff`, r = await this.f(url, { headers: { "User-Agent": "alyssum-beta-sync" } }); if (r.status !== 200) throw this.err("compare.diff", r.status, r);
    const t = await r.text(); if (!t.length) return new Map(); if (/^(diff too large|Sorry, this diff)/i.test(t)) return null;
    const m = new Map(); const blocks = t.split(/^diff --git /m).slice(1);
    for (const b of blocks) {
      const head = b.split("\n@@")[0], lines = head.split("\n"), first = lines[0]; if (first.startsWith('"') || /[^\x20-\x7e]/.test(first)) return null;            // مسارات مقتبسة/غير ASCII: لا نخمّن
      const ab = first.match(/^a\/(.+) b\/(.+)$/); if (!ab) return null; let a = ab[1], bb = ab[2], st = "M";
      for (const l of lines.slice(1)) { if (l.startsWith("new file mode")) st = "A"; else if (l.startsWith("deleted file mode")) st = "D"; else if (l.startsWith("rename from ")) { m.set(l.slice(12), "D"); st = "A"; } else if (l.startsWith("rename to ")) bb = l.slice(10); else if (l.startsWith("Binary files") && /\/dev\/null and/.test(l)) st = "A"; else if (l.startsWith("Binary files") && /and \/dev\/null/.test(l)) st = "D"; }
      if (st === "D") m.set(a, "D"); else m.set(bb, st);
    }
    return m;
  }
  /** مقارنة نقطتين: { status: ahead|behind|identical|diverged, commits:[{sha,message,author}] } (قديم←جديد). للسجل وكشف التراجع/التفرّع فقط؛ التطبيق نفسه من حالة الشجرة */
  async compare(from, to) {
    if (!from || from === to) return { status: "identical", commits: [] };
    try { const j = await this.json(`https://api.github.com/repos/${this.repo}/compare/${from}...${to}`); return { status: j.status, commits: (j.commits ?? []).map((c) => ({ sha: c.sha, message: String(c.commit?.message ?? "").split("\n")[0].slice(0, 120), author: c.commit?.author?.name ?? "" })) }; } catch { return null; }
  }
}
