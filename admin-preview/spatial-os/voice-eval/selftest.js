/* اختبار ذاتي لدوال التقييم بنصوص اصطناعية (لا صوت): يتحقق أن الحسابات صحيحة. ليس تقييماً لتعرّف الكلام. */
const S = require("./score"); let f = 0, n = 0; const ok = (name, c, x) => { n++; if (!c) f++; console.log((c ? "PASS " : "FAIL ") + name + (x !== undefined ? "  " + JSON.stringify(x) : "")); };
ok("WER=0 للنص المطابق", S.wer("شحال خدمنا اليوم؟", "شحال خدمنا اليوم") === 0);
ok("WER يتجاهل التشكيل وتوحيد الألف", S.wer("أكّد الطلب", "اكد الطلب") === 0);
ok("WER=1/3 لكلمة خاطئة من ثلاث", Math.abs(S.wer("افتح الطلب الان", "افتح الكلب الان") - 1 / 3) < 1e-9);
ok("WER يُعاقب الحذف والإضافة", S.wer("a b c d", "a b") === .5 && S.wer("a b", "a b c d") === 1);
ok("CER للنص الفارغ", S.cer("", "") === 0 && S.cer("", "x") === 1);
ok("أرقام عربية ← لاتينية", S.norm("١٢٣٤٥٦") === "123456");
ok("معرّف مفصول بمسافات", S.ids("افتح الطلب رقم 8 0 5 6 2 1").includes("805621"));
ok("معرّف حرفي", S.ids("Ouvre la commande A1182").includes("A1182") && S.ids("حل الكوموند نمرو A 1180").includes("A1180"));
ok("idExact يميّز رقماً خاطئاً", S.idExact(["123456"], "الطلب 123457") === false && S.idExact(["123456"], "الطلب ١٢٣٤٥٦") === true);
ok("idExact=null بلا معرّف مقصود", S.idExact([], "x") === null);
ok("اللغة: عربي/فرنسي/مخلوط/إنجليزي", S.lang("شحال خدمنا") === "ar" && S.lang("Donne-moi les commandes") === "fr" && S.lang("وريلي les commandes لي ما تأكدوش") === "mixed" && S.lang("show the orders") === "en");
ok("NLU: الطلبات غير المؤكدة ← orders.list", S.tool("وريني الطلبات لي ما تأكدوش") === "orders.list", S.tool("وريني الطلبات لي ما تأكدوش"));
ok("NLU: لا يخمّن نصاً بلا معنى", S.tool("blah qwerty zzz") === null);
ok("pct/mean", S.pct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50) === 6 && S.mean([1, 2, 3]) === 2);
console.log(f ? "FAILED " + f + "/" + n : "ALL PASS " + n + "/" + n); process.exit(f ? 1 : 0);
