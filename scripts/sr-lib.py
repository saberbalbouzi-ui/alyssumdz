"""تكبير فائق الدقة (Real-ESRGAN x4plus، ترخيص BSD-3) عبر onnxruntime على المعالج، بالبلاطات 128→512 مع تداخل.
النموذج لا يدخل المستودع: يُنزَّل مرة إلى $SR_MODEL (افتراضي /tmp/esr.onnx) من Hugging Face (bukuroo/RealESRGAN-ONNX)."""
import os, numpy as np, urllib.request
from PIL import Image
URL = "https://huggingface.co/bukuroo/RealESRGAN-ONNX/resolve/main/real-esrgan-x4plus-128.onnx"
_S = None
def session():
    global _S
    if _S: return _S
    import onnxruntime as ort
    p = os.environ.get("SR_MODEL", "/tmp/esr.onnx")
    if not os.path.exists(p): urllib.request.urlretrieve(URL, p)
    _S = ort.InferenceSession(p, providers=["CPUExecutionProvider"]); return _S
def sr4(im, T=128, ov=8):
    """يكبّر صورة RGB ×4 بلاطةً بلاطة؛ يُهمل هامش التداخل من كل ناتج ليختفي أثر الدرزات."""
    s = session(); a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0; h, w, _ = a.shape
    st = T - 2 * ov
    ph = (-(h) % st); pw = (-(w) % st)
    a = np.pad(a, ((ov, ov + ph), (ov, ov + pw), (0, 0)), mode="reflect")
    H, W, _ = a.shape; out = np.zeros((H * 4, W * 4, 3), np.float32)
    for y in range(0, H - T + 1, st):
        for x in range(0, W - T + 1, st):
            t = a[y:y + T, x:x + T].transpose(2, 0, 1)[None]
            r = s.run(None, {"image": t})[0][0].transpose(1, 2, 0)
            out[(y + ov) * 4:(y + T - ov) * 4, (x + ov) * 4:(x + T - ov) * 4] = r[ov * 4:(T - ov) * 4, ov * 4:(T - ov) * 4]
    out = out[ov * 4:ov * 4 + h * 4, ov * 4:ov * 4 + w * 4]
    return Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8))
