const { open, WEB, API } = require("./lib"); const fs = require("fs");
const AT = JSON.parse(fs.readFileSync((process.env.BETA_SECRETS_DIR || "/home/user/beta-secrets") + "/api-secrets.json", "utf8")).ADMIN_TOKEN;
(async () => {
  const inv = await fetch(API + "/admin/beta/invites", { method: "POST", headers: { Authorization: "Bearer " + AT, "Content-Type": "application/json" }, body: JSON.stringify({ note: "e2e-start", internal: true, max_uses: 1, expires_days: 1 }) }).then((r) => r.json()); const code = inv.code ?? inv.data?.code;
  const { b, p, log } = await open(); await p.goto(WEB + "/beta-start.html", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.waitForTimeout(2500);
  await p.fill("#n", "متجر صفحة البدء"); await p.fill("#i", "BETA-BAD-CODE"); await p.click("button[type=submit]"); await p.waitForTimeout(3500);
  console.log("bad:", (await p.innerText("#r")).slice(0, 100));
  await p.fill("#i", code); await p.click("button[type=submit]"); await p.waitForTimeout(4500);
  const r = await p.innerText("#r"); console.log("good:", r.replace(/pk_[a-z]+_[0-9a-f]+/, "pk_***").slice(0, 160), "| keyShown:", /pk_test_/.test(r));
  console.log("errs:", log.errs.filter(e => !/serviceWorker/.test(e)).slice(0, 3), "bad:", log.bad.slice(0, 4)); await b.close();
})();
