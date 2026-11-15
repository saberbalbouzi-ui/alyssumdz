// مولَّد من platform/env/environments.json بـ node platform/env/sync.mjs — لا تعدّله يدوياً.
export default {
  "version": 1,
  "environments": {
    "production": {
      "label": "Production",
      "cf_worker": "alyssum-platform-api",
      "cf_d1": "alyssum-platform-api",
      "api_host": "api.alyssumhub.fyi",
      "gateway_worker": "alyssum-shipping-gateway",
      "gateway_d1": "alyssum-shipping-gateway",
      "gateway_host": "shipping.alyssumhub.fyi",
      "app_host": "alyssumdz.com",
      "supabase_ref": "qvdaiundlkfbmjlummni",
      "modes": {
        "payments": "live",
        "sms": "live",
        "email": "live",
        "carriers": "live"
      },
      "egress": null,
      "pages_project": null,
      "supabase_project_name": "ALYSSUMDZ",
      "github_environment": null
    },
    "beta": {
      "label": "Beta",
      "cf_worker": "alyssum-platform-api-beta",
      "cf_d1": "alyssum-platform-api-beta",
      "api_host": "beta-api.alyssumhub.fyi",
      "gateway_worker": "alyssum-shipping-gateway-beta",
      "gateway_d1": "alyssum-shipping-gateway-beta",
      "gateway_host": "beta-shipping.alyssumhub.fyi",
      "app_host": "beta.alyssumdz.com",
      "supabase_ref": null,
      "supabase_ref_note": "مشروع Supabase مستقل للـBeta مطلوب إنشاؤه (BLOCKED حتى يُنشأ ويُحدَّد هنا)",
      "modes": {
        "payments": "sandbox",
        "sms": "sandbox",
        "email": "sandbox",
        "carriers": "sandbox"
      },
      "egress": {
        "allow": [
          "pay.chargily.net/test/",
          "cloudflare-dns.com/dns-query"
        ],
        "note": "قائمة سماح صارمة؛ كل ما عداها محجوب. الدفع: واجهة Chargily التجريبية فقط؛ وDNS-over-HTTPS لاستعلامات التحقق العام (بلا بيانات مستأجر)"
      },
      "pages_project": "alyssum-beta-web",
      "supabase_project_name": "alyssum-beta",
      "github_environment": "beta",
      "chargily_api": "https://pay.chargily.net/test/api/v2"
    },
    "local": {
      "label": "Local Development",
      "cf_worker": "alyssum-platform-api-local",
      "cf_d1": "alyssum-platform-api-local",
      "api_host": "localhost",
      "gateway_worker": "alyssum-shipping-gateway-local",
      "gateway_d1": "alyssum-shipping-gateway-local",
      "gateway_host": "localhost",
      "app_host": "localhost",
      "supabase_ref": null,
      "modes": {
        "payments": "sandbox",
        "sms": "sandbox",
        "email": "sandbox",
        "carriers": "sandbox"
      },
      "egress": {
        "allow": [],
        "note": "لا اتصال خارجي افتراضياً"
      },
      "pages_project": null,
      "supabase_project_name": null,
      "github_environment": null
    }
  },
  "never_outside_production": {
    "_note": "ما لا يُسمح لأي بيئة غير الإنتاج بالاتصال به أو حمله في إعداداتها/ملفاتها. public_key_markers = مفاتيح عامة (anon/publishable) لمشروع الإنتاج؛ identity_markers = هويات/بيانات شخصية للمالك",
    "hosts": [
      "api.alyssumhub.fyi",
      "shipping.alyssumhub.fyi",
      "alyssumdz.com"
    ],
    "supabase_refs": [
      "qvdaiundlkfbmjlummni"
    ],
    "live_url_prefixes": [
      "pay.chargily.net/api/"
    ],
    "live_credential_prefixes": [
      "live_",
      "sk_live",
      "pk_live",
      "rk_live",
      "gk_live_"
    ],
    "public_key_markers": [
      "sb_publishable_1ZtNDbkZ0uLFEdJeGkX0mw_zwXVI59h"
    ],
    "identity_markers": [
      "213559237239",
      "saber.balbouzi@gmail.com",
      "saberbalbouzi",
      "AKfycb"
    ],
    "other_project_names": [
      "ALYSSUMDZ",
      "imaginia-staging"
    ]
  }
};
