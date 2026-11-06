// استقبال إشعارات شركات التوصيل التي لم تُبنَ لها دالة خاصة بعد (مثل WeCan): يلتقط ويسجّل الطلب فقط (لا يغيّر أي طلب) لنعرف صيغته ثم نبني محوّلها.
// الرابط: https://<project>.supabase.co/functions/v1/carrier-webhook?c=<رمز الشركة>&s=<السر>   (السر = قيمة المتغيّر السري ZR_WEBHOOK_SECRET نفسها)
const SECRET = Deno.env.get("ZR_WEBHOOK_SECRET") ?? "";
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const u = new URL(req.url), c = (u.searchParams.get("c") ?? "").replace(/[^a-z0-9_-]/gi, "").slice(0, 30) || "unknown";
  if (req.method === "GET" || req.method === "HEAD") return json({ ok: true, webhook: "ready", carrier: c });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SECRET || u.searchParams.get("s") !== SECRET) return json({ error: "unauthorized" }, 401);
  const raw = (await req.text()).slice(0, 100_000);
  const hd: Record<string, string> = {};
  for (const [k, v] of req.headers) if (/^(content-type|user-agent|x-[a-z0-9-]*|webhook-[a-z0-9-]*|svix-[a-z0-9-]*|signature)$/i.test(k)) hd[k] = String(v).slice(0, 200);
  console.log("CARRIER_WEBHOOK " + JSON.stringify({ c, at: new Date().toISOString(), headers: hd, body: raw }));
  return json({ ok: true, received: true });
});
