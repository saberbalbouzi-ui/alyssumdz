/* كل وحدات المنصة بترتيب التسجيل الفعلي — مشتركة بين اختبارات العزل */
import { antifraud } from "../src/modules/antifraud.js"; import { capi } from "../src/modules/capi.js"; import { hooks } from "../src/modules/hooks.js";
import { digital } from "../src/modules/digital.js"; import { whatsapp } from "../src/modules/whatsapp.js"; import { sheets } from "../src/modules/sheets.js";
import { ab } from "../src/modules/ab.js"; import { ai } from "../src/modules/ai.js"; import { carts } from "../src/modules/carts.js"; import { tryon } from "../src/modules/tryon.js";
import { payments } from "../src/modules/payments.js"; import { sms } from "../src/modules/sms.js"; import { commerce } from "../src/modules/commerce.js"; import { sources } from "../src/modules/sources.js";
import { ads } from "../src/modules/ads.js"; import { adsOauth } from "../src/modules/adsoauth.js"; import { wallet } from "../src/modules/wallet.js"; import { agency } from "../src/modules/agency.js";
import { appstore } from "../src/modules/appstore.js"; import { marketplace } from "../src/modules/marketplace.js";
export const ALL = [antifraud, capi, hooks, digital, whatsapp, sheets, ab, ai, carts, tryon, payments, sms, commerce, sources, ads, adsOauth, wallet, agency, appstore, marketplace];
