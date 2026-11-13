"""يحلّل خرج v01-rls-test.sql (RES:{...}) محلياً: لا تسرّب قراءة للزائر/المهاجم، المالك يعمل، عزل العميلين A/B. يطبع JSON موجزاً."""
import json, re, sys
raw = open(sys.argv[1]).read().strip(); r = json.loads(raw[raw.index("RES:") + 4:])
cls = lambda v: "ERR" if str(v).startswith("ERR:") else ("0" if str(v) == "0" else ("POS" if re.fullmatch(r"-?\d+", str(v)) else "other"))
leaks = [k for k, v in r.items() if k.startswith(("anon.sel.", "atk.sel.")) and cls(v) == "POS"]
own_err = [k for k, v in r.items() if k.startswith("own.") and cls(v) == "ERR"]
cust = {k: r[k] for k in ("cust.A.sees_A", "cust.A.sees_B", "cust.B.sees_A", "cust.B.link_A_order", "cust.A_order_owner") if k in r}
checks = {"no_read_leaks": not leaks, "anon_all_blocked": all(cls(v) == "ERR" for k, v in r.items() if k.startswith("anon.sel.")), "owner_ok": not own_err,
  "A_sees_A": str(r.get("cust.A.sees_A")) == "true", "A_not_see_B": str(r.get("cust.A.sees_B")) == "false", "B_not_see_A": str(r.get("cust.B.sees_A")) == "false", "B_cannot_link_A_order": str(r.get("cust.B.link_A_order")) == "false", "A_unchanged_by_B": str(r.get("cust.A_name_after_B_update")) == "V01-A" and r.get("cust.A_order_owner") is True}
print(json.dumps({"probes": len(r), "leaks": leaks, "owner_errors": own_err, "customer": cust, "checks": checks, "all_pass": all(checks.values())}, ensure_ascii=False))
