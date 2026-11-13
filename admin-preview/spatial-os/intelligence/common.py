"""تسلسل موحّد للسياق/الذهب (يُستعمل في التدريب والتقييم والتشغيل التجريبي) + مدقّق مخطط مطابق لـ tools.js"""
import json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
REG = {t["name"]: t for t in json.load(open(os.path.join(HERE, "dataset", "registry.json"), encoding="utf8"))["tools"]}
SYSTEM = ("You are the ALYSSUM tool planner. Reply with ONE compact JSON only: "
          '{"t":"tool","c":[{"n":<tool>,"a":{...}}]} | {"t":"clarify","k":order|product|wilaya|period|what} | {"t":"refuse","k":perm|unsupported|bulk|unsafe} | {"t":"chat"}. '
          "Tools: sales.summary(period) sales.top_product(period,by) orders.list(status,wilaya,q,period,limit) orders.get(id) products.search(q) products.get(slug) inventory.read(slug|low) customers.find(q) settings.read(key) ui.open_panel(panel) ui.filter_orders(status,wilaya,q) ui.show_order(id) orders.confirm(id). "
          "periods: today yesterday week month all. status: nouvelle confirmee expediee livree annulee echec. Never invent ids. Max 3 calls.")
SYSTEM_FT = "ALYSSUM tool planner. Output one JSON plan."   # النموذج المضبوط يحفظ المخطط؛ تعليمة قصيرة توفّر ~85% من رموز الموجّه
def ctx_text(c):
    s = ["perm=" + ",".join(c.get("perms") or ["-"])]
    if c.get("last"): s.append("last=%s%s" % (c["last"]["tool"], json.dumps(c["last"]["args"], ensure_ascii=False, separators=(",", ":"))))
    if c.get("ids"): s.append("ids=" + ",".join(c["ids"]))
    if c.get("focus"): s.append("focus=" + c["focus"])
    if c.get("prod"): s.append("prod=" + c["prod"])
    if c.get("cands"): s.append("cands=" + ";".join("%s:%s/%s" % (x["slug"], x["title"], x.get("fr", "")) for x in c["cands"]))
    return " | ".join(s)
def user_text(case): return "CTX: %s\nMSG: %s" % (ctx_text(case["ctx"]), case["text"])
def plan_text(g): return json.dumps(g, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
def parse_plan(txt):
    """يستخرج أول كائن JSON من ناتج النموذج؛ يعيد (خطة|None)"""
    txt = (txt or "").strip(); i = txt.find("{")
    if i < 0: return None
    d = 0
    for j in range(i, len(txt)):
        if txt[j] == "{": d += 1
        elif txt[j] == "}":
            d -= 1
            if d == 0:
                try: return json.loads(txt[i:j + 1])
                except Exception: return None
    return None
def validate_call(name, args):
    """مطابق لدلالة AgentTools.validate: لا مفاتيح زائدة، أنواع، enum، أنماط، حدود"""
    t = REG.get(name)
    if not t: return False, "unknown-tool"
    sch = t["schema"]; props = sch.get("properties", {})
    if args is None: args = {}
    if not isinstance(args, dict): return False, "args-not-object"
    for k in args:
        if k not in props: return False, "unknown-arg:" + k
    for k, p in props.items():
        if k not in args: 
            if k in sch.get("required", []): return False, "missing:" + k
            continue
        x = args[k]
        if p["type"] == "string":
            if not isinstance(x, str): return False, "type:" + k
            if "maxLength" in p and len(x) > p["maxLength"]: return False, "too-long:" + k
            if "minLength" in p and len(x) < p["minLength"]: return False, "too-short:" + k
            if "pattern" in p and not re.search(p["pattern"].replace("\\p{L}", "\\w").replace("\\p{N}", "\\d"), x): return False, "pattern:" + k
            if "enum" in p and x not in p["enum"]: return False, "enum:" + k
        elif p["type"] == "integer":
            if not isinstance(x, int) or isinstance(x, bool): return False, "type:" + k
            if "minimum" in p and x < p["minimum"]: return False, "min:" + k
            if "maximum" in p and x > p["maximum"]: return False, "max:" + k
        elif p["type"] == "boolean":
            if not isinstance(x, bool): return False, "type:" + k
    return True, ""
def canon_call(c): return (c["n"], json.dumps(c.get("a") or {}, sort_keys=True, ensure_ascii=False))
