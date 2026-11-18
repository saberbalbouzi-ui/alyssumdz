/* مُنشئ محوّل Beta الحقيقي (مشترك بين beta-release.mjs ومجسّ الاختبار الحقيقي): يفرض الحواجز قبل أي اتصال */
import { CloudflareAdapter } from "./cloudflare.mjs";
export async function buildRealAdapter({ env, registry, contracts, noSupabase = false, fetchFn = fetch, runTool }) {
  const acc = env.BETA_CF_ACCOUNT_ID; if (!acc) throw new Error("BETA_CF_ACCOUNT_ID مطلوب");
  const B = registry.environments.beta; let supabase = null;
  if (!noSupabase) { const ref = env.BETA_SUPABASE_REF; if (!ref) throw new Error("BETA_SUPABASE_REF مطلوب (أو --no-supabase صراحةً لتعطيل حماية بيانات Supabase)"); if (ref !== B.supabase_ref || ref === registry.environments.production.supabase_ref) throw new Error("guard: BETA_SUPABASE_REF لا يطابق مشروع Beta المسجَّل"); supabase = { ref, pat: env.BETA_SUPABASE_PAT || null }; }
  const a = new CloudflareAdapter({ accountId: acc, token: env.BETA_CF_DEPLOY_TOKEN || null, registry, contracts, supabase, fetchFn, ...(runTool ? { runTool } : {}), env: { ...env } }); await a.assertAccountClean(); return a;
}
