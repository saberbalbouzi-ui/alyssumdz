// يُحمَّل بـnode --import: يستبدل fetch بمسجِّل. NET_LOG = ملف يُكتب فيه سطر JSON لكل طلب صادر ({host,path,method}).
// NET_MODE: "reject" (فشل اتصال: ECONNREFUSED) | "500" (الخادم يرد 500). لا طلب حقيقي يخرج أبداً.
import { appendFileSync } from "node:fs";
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === "string" ? input : input.url ?? String(input));
  if (process.env.NET_LOG) appendFileSync(process.env.NET_LOG, JSON.stringify({ host: u.hostname, path: u.pathname, method: init.method || "GET" }) + "\n");
  if ((process.env.NET_MODE || "reject") === "reject") { const e = new TypeError("fetch failed"); e.cause = { code: "ECONNREFUSED" }; throw e; }
  return new Response("{}", { status: 500 });
};
