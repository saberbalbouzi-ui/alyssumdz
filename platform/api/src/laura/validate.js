/* مدقّق مخططات الأدوات: type/enum/طول/نمط/حدود/required ولا مفاتيح زائدة — مخرجات النموذج غير موثوقة أبداً */
export function validateArgs(schema, v) {
  if (!schema || schema.type !== "object") return { ok: false, error: "schema" };
  if (v == null) v = {}; if (typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "args-not-object" };
  const props = schema.properties || {}, out = {};
  for (const k of Object.keys(v)) if (!Object.prototype.hasOwnProperty.call(props, k)) return { ok: false, error: "unknown-arg:" + String(k).slice(0, 24) };
  for (const k of Object.keys(props)) {
    const p = props[k], x = v[k]; if (x === undefined) { if ((schema.required || []).includes(k)) return { ok: false, error: "missing:" + k }; continue; }
    if (p.type === "string") {
      if (typeof x !== "string") return { ok: false, error: "type:" + k }; if (p.maxLength != null && x.length > p.maxLength) return { ok: false, error: "too-long:" + k }; if (p.minLength != null && x.length < p.minLength) return { ok: false, error: "too-short:" + k };
      if (p.enum && !p.enum.includes(x)) return { ok: false, error: "enum:" + k }; if (p.pattern && !new RegExp(p.pattern).test(x)) return { ok: false, error: "pattern:" + k };
    } else if (p.type === "integer") {
      if (!Number.isInteger(x)) return { ok: false, error: "type:" + k }; if (p.minimum != null && x < p.minimum) return { ok: false, error: "min:" + k }; if (p.maximum != null && x > p.maximum) return { ok: false, error: "max:" + k };
    } else if (p.type === "boolean") { if (typeof x !== "boolean") return { ok: false, error: "type:" + k }; }
    else return { ok: false, error: "schema-type:" + k };
    out[k] = x;
  }
  return { ok: true, value: out };
}
