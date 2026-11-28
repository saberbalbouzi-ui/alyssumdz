import { Tally, makeEnv } from "./_harness.mjs"; import { buildBody, READ_SCOPES } from "../tools/laura-issue-key.mjs"; import { TOOLS } from "../src/laura/tools.js";
const { ok, done } = Tally(); const bad = (s) => { try { buildBody(s); return false; } catch { return true; } };
ok("14 نطاقاً بلا * ولا :write", READ_SCOPES.length === 14 && !READ_SCOPES.includes("*") && !READ_SCOPES.some((s) => /:write$/.test(s)));
ok("يرفض *", bad(["laura:chat", "*"])); ok("يرفض events:write وcatalog:write وlaura:write", ["events:write", "catalog:write", "laura:write", "payments:write"].every((w) => bad(["laura:chat", w])));
ok("يشترط laura:chat", bad(["orders:read"])); ok("الجسم الافتراضي سليم", buildBody().scopes.length === 14);
ok("تغطي كل أدوات القراءة (كل tier=read بنطاقها)", TOOLS.filter((t) => t.tier === "read").every((t) => READ_SCOPES.includes(t.scope)), TOOLS.filter((t) => t.tier === "read" && !READ_SCOPES.includes(t.scope)).map((t) => t.name));
/* مفتاح بهذه النطاقات فعلياً: يرى القراءة كلها ولا يرى كتابة */
const { commerce } = await import("../src/modules/commerce.js"), { laura } = await import("../src/modules/laura.js"), { signActor } = await import("../src/laura/actor.js"), { createMock, KEY } = await import("./_mock_llm.mjs");
const E = makeEnv([commerce, laura], { config: { LAURA_LLM_KEY: KEY, LAURA_ACTOR_SECRET: "actor-secret-0123456789abcdef", LAURA_WRITES: "on" } }); E.fake.handler = createMock().handler;
const A = await E.tenant("A"), k = (await E.adm("POST", `/admin/tenants/${A.id}/keys`, buildBody()))[1].key, now = Math.floor(E.clock.t / 1000);
const h = { "x-laura-actor": await signActor("actor-secret-0123456789abcdef", { sub: "o", role: "owner", perms: ["*"], tid: A.id, iat: now - 5, exp: now + 300 }) };
const [, b] = await E.call("GET", "/v1/laura/tools", null, k, { caps: "client_exec" }, h);
ok("مفتاح القراءة: بلا أي أداة كتابة حتى مع LAURA_WRITES=on وcaps", b.tools.length > 0 && !b.tools.some((t) => t.tier === "write"), b.tools?.filter((t) => t.tier === "write").map((t) => t.name));
done();
