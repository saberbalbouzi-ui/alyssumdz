#!/usr/bin/env node
/* حارس هوية حساب Cloudflare لـBeta (قراءة فقط، GET حصراً إلى api.cloudflare.com). يُشغَّل قبل أي إنشاء مورد أو اختبار:
   يرفض الحساب الذي يحوي موارد Production (Worker/D1 بأسماء الإنتاج) أو منطقة (zone) نطاقات الإنتاج. لا يطبع الرمز.
   الاستعمال:  BETA_CF_ACCOUNT_ID=<32hex> BETA_CF_API_TOKEN=<رمز> node platform/env/cf-account-check.mjs
   رموز الخروج: 0 = SEPARATE (لا أثر لـProduction وتحقق من المناطق) | 2 = PRODUCT_ACCOUNT (حساب الإنتاج أو يحوي موارده — مرفوض) | 3 = UNVERIFIED (تعذّر التحقق: الرمز/الصلاحية) | 1 = مدخلات خاطئة.
   الصلاحيات المقروءة فقط: Account Settings:Read، D1:Read، Workers Scripts:Read، Pages:Read، Zone:Read. UNVERIFIED ليس نجاحاً. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const REG = JSON.parse(readFileSync(new URL("./environments.json", import.meta.url), "utf8")), P = REG.environments.production, N = REG.never_outside_production ?? {};
const root = (h) => String(h || "").toLowerCase().split(".").slice(-2).join(".");
export const prodNames = () => new Set([P.cf_worker, P.cf_d1, P.gateway_worker, P.gateway_d1, P.pages_project].filter(Boolean));
export const prodZones = () => new Set([P.app_host, P.api_host, P.gateway_host, ...(N.hosts ?? [])].filter(Boolean).map(root));
export async function checkAccount({ accountId, token, fetchFn = fetch }) {
  if (!/^[0-9a-f]{32}$/.test(String(accountId || ""))) return { code: 1, verdict: "BAD_INPUT", findings: ["BETA_CF_ACCOUNT_ID غير صالح (32 خانة hex)"] };
  if (!token) return { code: 1, verdict: "BAD_INPUT", findings: ["BETA_CF_API_TOKEN مفقود"] };
  const api = "https://api.cloudflare.com/client/v4", H = { Authorization: "Bearer " + token }, unverified = [], found = [], counts = {};
  const get = async (path, key, pick) => {
    let r, j; try { r = await fetchFn(api + path, { method: "GET", headers: H }); j = await r.json(); } catch { unverified.push(`${key}: تعذّر الاتصال`); return null; }
    if (!r.ok || !j?.success) { unverified.push(`${key}: HTTP ${r.status} (الرمز أو الصلاحية)`); return null; }
    const arr = (j.result ?? []).map(pick); counts[key] = arr.length; return arr;
  };
  const acct = await get(`/accounts/${accountId}`, "account", () => 1);
  if (!acct) return { code: 3, verdict: "UNVERIFIED", findings: unverified, counts };
  const [d1, workers, pages, zones] = [
    await get(`/accounts/${accountId}/d1/database?per_page=100`, "d1", (x) => x.name),
    await get(`/accounts/${accountId}/workers/scripts`, "workers", (x) => x.id),
    await get(`/accounts/${accountId}/pages/projects`, "pages", (x) => x.name),
    await get(`/zones?account.id=${accountId}&per_page=50`, "zones", (x) => String(x.name || "").toLowerCase())];
  const pn = prodNames(), pz = prodZones();
  for (const [k, list] of [["d1", d1], ["workers", workers], ["pages", pages]]) for (const n of list ?? []) if (pn.has(n)) found.push(`مورد Production في الحساب: ${k}/${n}`);
  for (const z of zones ?? []) if (pz.has(root(z))) found.push(`منطقة نطاق Production في الحساب: ${z}`);
  if (found.length) return { code: 2, verdict: "PRODUCT_ACCOUNT", findings: found, counts };
  if (unverified.length) return { code: 3, verdict: "UNVERIFIED", findings: unverified, counts };
  return { code: 0, verdict: "SEPARATE", findings: [], counts };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const r = await checkAccount({ accountId: process.env.BETA_CF_ACCOUNT_ID, token: process.env.BETA_CF_API_TOKEN });
  console.log(`حساب Cloudflare: ${r.verdict}`, r.counts ? JSON.stringify(r.counts) : ""); for (const f of r.findings) console.log("  - " + f);
  if (r.code === 0) console.log("لا موارد ولا مناطق Production في هذا الحساب (لا يثبت وحده أنه حساب جديد؛ يثبت أنه ليس حساب الإنتاج).");
  if (r.code === 3) console.log("RESULT: UNVERIFIED — ليس نجاحاً");
  process.exit(r.code);
}
