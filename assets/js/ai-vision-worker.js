/* عامل «الرؤية الذكية» (Web Worker من نوع module): يشغّل نماذج Hugging Face داخل المتصفح بعيداً عن واجهة الصفحة فلا تتجمّد.
   كشف العناصر: D-FINE صغير مدرَّب على COCO (80 صنفاً) + آخر على Objects365 (365 صنفاً: صحن، قلم، إبريق، عبوة…).
   القصّ: SAM 2.1 tiny (Segment Anything) بصندوق العنصر أو بنقرة. تُنزَّل النماذج مرة واحدة وتُحفظ في ذاكرة المتصفح.
   لا يُستدعى إلا من assets/js/ai-vision.js. */
import * as T from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";
T.env.allowLocalModels = false;
const M = { depth: "onnx-community/depth-anything-v2-small", sam: "onnx-community/sam2.1-hiera-tiny-ONNX", coco: "onnx-community/dfine_s_coco-ONNX", o365: "onnx-community/dfine_s_obj365-ONNX" };
const MIGAN = "https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx", ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
let sam = null, cur = null, mg = null; const dets = {};
/* ترميم الخلفية محلياً: MI-GAN (رخصة MIT، ~27MB) يرسم ما خلف العنصر المحذوف. يُحفظ في ذاكرة المتصفح بعد أول تنزيل */
function getMigan(id) {
  if (!mg) mg = (async () => {
    const ort = await import(ORT + "ort.min.mjs"); ort.env.wasm.wasmPaths = ORT; let buf = null, cache = null;
    try { cache = await caches.open("alyssum-ai-models"); const hit = await cache.match(MIGAN); if (hit) buf = await hit.arrayBuffer(); } catch (e) { cache = null; }
    if (!buf) { const r = await fetch(MIGAN); if (!r.ok) throw new Error("migan " + r.status); const total = +r.headers.get("content-length") || 28079181, rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; postMessage({ id, progress: { file: "migan", loaded: got, total } }); }
      const all = new Uint8Array(got); let o = 0; parts.forEach(p => { all.set(p, o); o += p.length; }); buf = all.buffer; if (cache) try { await cache.put(MIGAN, new Response(all.slice())); } catch (e) { } }
    return { ort, s: await ort.InferenceSession.create(new Uint8Array(buf)) };
  })().catch(e => { mg = null; throw e; });
  return mg;
}
const prog = id => p => { if (p && p.status === "progress" && p.total) postMessage({ id, progress: { file: String(p.file || ""), loaded: p.loaded || 0, total: p.total } }); };
const raw = a => new T.RawImage(new Uint8ClampedArray(a.data), a.w, a.h, 4);
/* كرت الشاشة (WebGPU) إن توفّر: نسخة q4f16 أصغر وأسرع بكثير؛ وإلا المعالج (WASM int8). أي فشل ← رجوع تلقائي للمعالج */
let gpuOk = null, dev = "wasm";
let f16 = false;
async function hasGPU() { if (gpuOk !== null) return gpuOk; try { const ad = self.navigator && navigator.gpu && await navigator.gpu.requestAdapter(); const inf = (ad && ad.info) || {}; gpuOk = !!ad && !ad.isFallbackAdapter && !/swiftshader|llvmpipe|software/i.test((inf.vendor || "") + " " + (inf.architecture || "") + " " + (inf.description || "")); f16 = !!(ad && ad.features && ad.features.has("shader-f16")); } catch (e) { gpuOk = false; } return gpuOk; }
function loadSam(id, gpu) { return Promise.all([T.Sam2Model.from_pretrained(M.sam, gpu ? { device: "webgpu", dtype: f16 ? "q4f16" : "q4", progress_callback: prog(id) } : { device: "wasm", dtype: "int8", progress_callback: prog(id) }), T.AutoProcessor.from_pretrained(M.sam)]); }
function getSam(id, noGpu) {
  if (!sam) sam = (async () => { if (!noGpu && await hasGPU()) { try { const r = await loadSam(id, true); dev = "webgpu"; return r; } catch (e) { console.warn("webgpu → wasm", e); gpuOk = false; } } dev = "wasm"; return loadSam(id, false); })().catch(e => { sam = null; throw e; });
  return sam;
}
const finite = t => { const d = t.data; for (let i = 0; i < Math.min(d.length, 4096); i += 7) if (!Number.isFinite(d[i])) return false; return true; };
function getDet(k, id) { if (!dets[k]) dets[k] = T.pipeline("object-detection", M[k], { device: "wasm", dtype: "int8", progress_callback: prog(id) }).catch(e => { dets[k] = null; throw e; }); return dets[k]; }
/* العمق (Depth Anything V2 صغير، رخصة Apache-2.0، ~27MB int8): تقدير عمق نسبي لكل بكسل — أساس «فصل ما وراء الأشخاص» كما تفعل أدوات التصميم */
let dpth = null;
function getDepth(id) { if (!dpth) dpth = T.pipeline("depth-estimation", M.depth, { device: "wasm", dtype: "int8", progress_callback: prog(id) }).catch(e => { dpth = null; throw e; }); return dpth; }
const ops = {
  async depth(a, id) { const p = await getDepth(id), r = await p(raw(a)), t = r.predicted_depth, d = t.dims; return { w: d[d.length - 1], h: d[d.length - 2], data: Float32Array.from(t.data) }; },
  async load(a, id) { if (a.sam) await getSam(id); for (const k of a.det || []) await getDet(k, id); return true; },
  /* كشف: [{src, label, score, box:[x0,y0,x1,y1]}] بإحداثيات الصورة المُرسلة */
  async detect(a, id) {
    const img = raw(a), out = [];
    for (const k of a.models || ["coco", "o365"]) { const p = await getDet(k, id), r = await p(img, { threshold: a.thr || .1, percentage: false }); r.forEach(d => out.push({ src: k, label: d.label, score: d.score, box: [d.box.xmin, d.box.ymin, d.box.xmax, d.box.ymax] })); }
    return out;
  },
  /* ترميم: صورة RGBA + قناع (1 = يُرسم) ← RGBA مرمَّمة بنفس الأبعاد */
  async inpaint(a, id) {
    const { ort, s } = await getMigan(id), N = a.w * a.h, D = new Uint8Array(a.data), M = new Uint8Array(a.mask), img = new Uint8Array(3 * N), m = new Uint8Array(N);
    for (let i = 0; i < N; i++) { img[i] = D[i * 4]; img[N + i] = D[i * 4 + 1]; img[2 * N + i] = D[i * 4 + 2]; m[i] = M[i] ? 0 : 255; }
    const o = await s.run({ image: new ort.Tensor("uint8", img, [1, 3, a.h, a.w]), mask: new ort.Tensor("uint8", m, [1, 1, a.h, a.w]) }), r = o.result.data, out = new Uint8ClampedArray(N * 4);
    for (let i = 0; i < N; i++) { out[i * 4] = r[i]; out[i * 4 + 1] = r[N + i]; out[i * 4 + 2] = r[2 * N + i]; out[i * 4 + 3] = 255; }
    return { masks: out };
  },
  /* ترميز الصورة مرة واحدة (أثقل خطوة)، ثم كل نقرة/صندوق سريع */
  async embed(a, id) {
    let [m, p] = await getSam(id), inp = await p(raw(a)), emb = null;
    try { emb = await m.get_image_embeddings(inp); if (dev === "webgpu" && !Object.values(emb).every(finite)) throw new Error("nan"); }
    catch (e) { if (dev !== "webgpu") throw e; console.warn("webgpu embed → wasm", e); sam = null; gpuOk = false; [m, p] = await getSam(id, true); inp = await p(raw(a)); emb = await m.get_image_embeddings(inp); }      // كرت الشاشة فشل ← المعالج
    cur = { m, emb, W: a.w, H: a.h, rs: inp.reshaped_input_sizes[0] }; return { rs: cur.rs, dev };
  },
  /* قناع لصندوق و/أو نقاط [x,y,label(1 داخل، 0 خارج)] ← 3 أقنعة منخفضة الدقة (logits) + درجاتها */
  async prompt(a) {
    if (!cur) throw new Error("no-image"); const { m, emb, W, H, rs } = cur, sx = rs[1] / W, sy = rs[0] / H, inp = {};
    if (a.box) inp.input_boxes = new T.Tensor("float32", Float32Array.of(a.box[0] * sx, a.box[1] * sy, a.box[2] * sx, a.box[3] * sy), [1, 1, 4]);
    if (a.pts && a.pts.length) { inp.input_points = new T.Tensor("float32", Float32Array.from(a.pts.flatMap(p => [p[0] * sx, p[1] * sy])), [1, 1, a.pts.length, 2]); inp.input_labels = new T.Tensor("int64", BigInt64Array.from(a.pts.map(p => BigInt(p[2] == null ? 1 : p[2]))), [1, 1, a.pts.length]); }
    const o = await m({ ...emb, ...inp });
    return { scores: Array.from(o.iou_scores.data), obj: o.object_score_logits ? Number(o.object_score_logits.data[0]) : 1, masks: new Float32Array(o.pred_masks.data), dims: o.pred_masks.dims.slice(), rs };
  }
};
self.onmessage = async e => {
  const { id, op, a } = e.data;
  try { const r = await ops[op](a || {}, id); self.postMessage({ id, ok: true, r }, r && r.masks ? [r.masks.buffer] : []); }
  catch (err) { self.postMessage({ id, ok: false, err: String((err && err.message) || err) }); }
};
self.postMessage({ ready: true });
