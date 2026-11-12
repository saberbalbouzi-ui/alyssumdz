# يولّد fake-mic.wav: صمت 0.6ث ← «كلام» اصطناعي (توافقيات تتغيّر بتعديل سعة) 1.6ث ← صمت 2.2ث (يتكرر كميكروفون وهمي في Chromium).
# ليس كلاماً حقيقياً: يكفي لاختبار مسار الميكروفون/كشف الكلام/ترميز WAV/الإرسال؛ جودة التعرّف على كلام عربي حقيقي غير مختبرة هنا.
import wave, struct, math
sr = 16000; out = []
seg = lambda n, f: out.extend(f(i / sr) for i in range(n))
seg(int(.6 * sr), lambda t: 0)
def sp(t):
    f0 = 130 + 25 * math.sin(t * 5); env = (0.55 + 0.45 * math.sin(t * 9.0)) ** 1.2
    return 0.22 * env * sum(math.sin(2 * math.pi * f0 * k * t) / k for k in range(1, 9)) / 2.2
seg(int(1.6 * sr), sp); seg(int(2.2 * sr), lambda t: 0)
w = wave.open('fake-mic.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x)) * 32767)) for x in out)); w.close()
# silence.wav: ضجيج منخفض جداً (±0.2%) لاختبار «لم أسمع كلاماً»
