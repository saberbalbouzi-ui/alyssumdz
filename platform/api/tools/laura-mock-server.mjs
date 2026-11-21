/* خادم HTTP محلي يحاكي نقطة generateContent (للتطوير/الاختبار المحلي فقط؛ ليس نموذجاً لغوياً). التحكم: POST /__ctl { fail, loop }. */
import http from "node:http";
import { createMock } from "../test/_mock_llm.mjs";
export function startMock(port = 8799) {
  const mock = createMock();
  const srv = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks).toString("utf8");
    if (req.url === "/__ctl") { const j = JSON.parse(body || "{}"); if ("fail" in j) mock.fail = j.fail; if ("loop" in j) mock.loop = !!j.loop; res.end("ok"); return; }
    if (req.url === "/__calls") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ n: mock.calls.length, keys: [...new Set(mock.calls.map((x) => x.key))], lastTools: mock.lastBody?.tools?.[0]?.functionDeclarations?.map((d) => d.name) ?? [] })); return; }
    const ac = new AbortController(); req.on("close", () => ac.abort());
    try { const r = await mock.handler("http://" + req.headers.host + req.url, { method: req.method, headers: req.headers, body, signal: ac.signal }); res.statusCode = r[0]; res.setHeader("content-type", "application/json"); res.end(typeof r[1] === "string" ? r[1] : JSON.stringify(r[1])); }
    catch { res.destroy(); }
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok({ srv, mock, port })));
}
if (process.argv[1].endsWith("laura-mock-server.mjs")) { const { port } = await startMock(+process.env.PORT || 8799); console.log("mock LLM on", port); }
