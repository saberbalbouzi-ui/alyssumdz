<?php
declare(strict_types=1);
/* لقطة ذهبية لسلوك محوّلات PHP أمام المحاكيات الصارمة: كل خطوة تسجّل الطلبات الصادرة (وجهة/معاملات/ترويسات/جسم) والردود والنتيجة.
   تُستعمل لهدفين: (1) اختبار PHP يتحقق أن اللقطة المحفوظة حديثة؛ (2) اختبار بوابة Cloudflare JS يعيد تشغيل المحوّلات JS على الردود نفسها
   ويشترط أن تكون طلباتها ونتائجها مطابقة بالحرف — فنجاح ياليدين يعني نجاح الباقي بالصيغة نفسها في النسختين.
   php scripts/gen-carrier-golden.php   (يكتب saas/gateway/test/carrier-golden.json) */
require_once __DIR__ . '/../../php-edition/shipping/src/autoload.php';
require_once __DIR__ . '/carrier-sims.php';

use Alyssum\Shipping\{Calibrator, OurGeo, Parcel, ShippingFactory, StatusMapper};
use Alyssum\Shipping\Http\{HttpClient, HttpResponse};

final class RecSim implements HttpClient
{
    public array $rec = [];
    public function __construct(public Sim $sim) {}
    public function request(string $method, string $url, array $headers = [], ?string $body = null): HttpResponse
    {
        $r = $this->sim->request($method, $url, $headers, $body);
        $this->rec[] = ['m' => $method, 'u' => $url, 'h' => $headers, 'b' => $body, 's' => $r->status, 'r' => (string)$r->body];
        return $r;
    }
}

function carrier_golden(): array
{
    $dict = json_decode((string)file_get_contents(__DIR__ . '/../../php-edition/shipping/data/status-dict.json'), true);
    $cfg = [
        'yalidine'  => ['sim' => fn() => new YalidineSim(), 'good' => ['apiId' => 'AID', 'apiToken' => 'TOK'], 'bad' => ['apiId' => 'AID', 'apiToken' => 'NOPE'], 'deskKey' => 'desk_id', 'deskVal' => 161601, 'fam' => 'yalidine'],
        'dhd'       => ['sim' => fn() => new EcotrackSim(), 'good' => ['token' => 'TOK'], 'bad' => ['token' => 'NOPE'], 'deskKey' => 'desk_code', 'deskVal' => '16000', 'fam' => 'ecotrack'],
        'noest'     => ['sim' => fn() => new NoestSim(), 'good' => ['apiToken' => 'TOK', 'userGuid' => 'GUID'], 'bad' => ['apiToken' => 'NOPE', 'userGuid' => 'GUID'], 'deskKey' => 'desk_code', 'deskVal' => '16A', 'fam' => 'noest'],
        'maystro'   => ['sim' => fn() => new MaystroSim(), 'good' => ['apiKey' => 'TOK'], 'bad' => ['apiKey' => 'NOPE'], 'deskKey' => null, 'deskVal' => null, 'fam' => 'maystro'],
        'zrexpress' => ['sim' => fn() => new ZRSim(), 'good' => ['token' => 'TK', 'key' => 'KY'], 'bad' => ['token' => 'TK', 'key' => 'BAD'], 'deskKey' => null, 'deskVal' => null, 'fam' => 'zrexpress'],
    ];
    $base = ['order_ref' => 'G1', 'name' => 'Karim Benali', 'phone' => '+213 550 12 34 56', 'wilaya' => 16, 'commune' => 'Bab Ezzouar', 'address' => 'Cité 5 Juillet', 'total' => 4200, 'fee' => 400, 'products' => "عسل ×2 = 3800 DA\nزيت ×1 = 400 DA"];
    $out = [];
    $exc = fn(Throwable $e) => str_contains(get_class($e), 'CredentialsException') ? 'cred' : (str_contains(get_class($e), 'CarrierApiException') ? 'api' : 'other');

    foreach ($cfg as $code => $c) {
        $steps = [];
        $mk = function (array $cred, ?Sim $sim = null) use ($code, $c): array {
            $sim ??= ($c['sim'])(); $rec = new RecSim($sim);
            return [$sim, $rec, ShippingFactory::make($code, $rec)->authenticate($cred)];
        };
        $run = function (string $name, string $op, array $arg, \Closure $do, array $cred, ?Sim $sim = null, array $extraCred = []) use (&$steps, $mk, $exc): void {
            [$s, $rec, $ad] = $mk($cred + $extraCred, $sim);
            $res = null;
            try { $res = $do($ad, $s); } catch (Throwable $e) { $res = ['exc' => $exc($e)]; }
            $steps[] = ['name' => $name, 'op' => $op, 'arg' => $arg, 'cred' => $cred + $extraCred, 'calls' => $rec->rec, 'result' => $res];
        };
        $P = fn(array $o = []) => Parcel::fromArray($o + $base);
        $cre = fn($r) => ['ok' => $r->ok, 'tracking' => $r->tracking, 'error' => $r->error];

        $run('ping_ok', 'ping', [], fn($ad) => $ad->ping(), $c['good']);
        $run('ping_bad', 'ping', [], fn($ad) => $ad->ping(), $c['bad']);
        $run('create_home', 'create', $base, fn($ad) => $cre($ad->createParcel($P())), $c['good']);
        foreach (['0550123456', '550123456'] as $i => $ph) {
            $a = ['phone' => $ph, 'order_ref' => 'G-ph' . $i];
            $run('create_phone_' . $ph, 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        }
        $a = ['commune' => 'kouba', 'address' => '', 'phone2' => '0661234567', 'note' => 'اتصل قبل الوصول', 'order_ref' => 'G-b'];
        $run('create_blank_address_phone2_note', 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        $a = ['wilaya' => 65, 'commune' => 'Aïn Oussera', 'order_ref' => 'G-65'];
        $run('create_new_wilaya_65', 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        $a = ['wilaya' => 69, 'commune' => 'El Abiodh Sidi Cheikh', 'order_ref' => 'G-69'];
        $run('create_new_wilaya_69', 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        $a = ['wilaya' => 65, 'commune' => 'Ain Oussera', 'order_ref' => 'G-65b'];
        $run('create_commune_spelling', 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        $a = ['stop_desk' => true, 'order_ref' => 'G-sd0'];
        $run('create_stopdesk_without_code', 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        $a = ['stop_desk' => true, 'order_ref' => 'G-sd1'] + ($c['deskKey'] ? [$c['deskKey'] => $c['deskVal']] : []);
        $run('create_stopdesk', 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        $a = ['commune' => 'Zzyzx Qwerty', 'order_ref' => 'G-unk'];
        $run('create_unknown_commune', 'create', $a + $base, fn($ad) => $cre($ad->createParcel($P($a))), $c['good']);
        $run('create_duplicate', 'create2', $base, fn($ad) => [$cre($ad->createParcel($P())), $cre($ad->createParcel($P()))], $c['good']);
        $run('create_rate_limited', 'create', $base, function ($ad, $s) use ($P, $cre) { $s->rateLimit = true; return $cre($ad->createParcel($P())); }, $c['good']);
        $run('create_bad_credentials', 'create', $base, fn($ad) => $cre($ad->createParcel($P())), $c['bad']);

        /* تتبع: كل مدخلات القاموس عبر ردّ المحاكي الحقيقي */
        $entries = [];
        $fam = $c['fam'];
        foreach (($code === 'maystro' ? [] : ($dict[$fam]['exact'] ?? [])) as $raw => $_) { $entries[] = (string)$raw; }
        foreach (($dict[$fam]['event_key'] ?? []) as $raw => $_) { $entries[] = (string)$raw; }
        foreach (($dict[$fam]['codes'] ?? []) as $raw => $_) { $entries[] = (string)$raw; }
        $entries[] = 'حالة_غريبة_9981';
        if ($code === 'noest') { $entries[] = '__finance_after_delivery'; }
        $sim = ($c['sim'])();
        [, , $ad0] = $mk($c['good'], $sim);
        $trk = $ad0->createParcel($P(['order_ref' => 'G-trk']))->tracking;
        foreach ($entries as $raw) {
            $sim->rateLimit = false;
            if ($raw === '__finance_after_delivery') { $sim->history[$trk] = ['upload', 'livre', 'verssement_admin_cust']; $sim->state[$trk] = 'livre'; }
            else { $sim->setStatus($trk, $raw); if (property_exists($sim, 'history')) { $sim->history[$trk] = [$raw]; } }
            $run('track_' . $raw, 'track', ['tracking' => $trk], function ($ad) use ($trk) { $r = $ad->trackParcel($trk); return ['status' => $r->status, 'rawStatus' => $r->rawStatus]; }, $c['good'], $sim);
        }
        $run('track_rate_limited', 'track', ['tracking' => $trk], function ($ad, $s) use ($trk) { $s->rateLimit = true; return ['status' => $ad->trackParcel($trk)->status]; }, $c['good'], $sim);

        /* إلغاء */
        $sim = ($c['sim'])(); [, , $ad0] = $mk($c['good'], $sim);
        $t2 = $ad0->createParcel($P(['order_ref' => 'G-can', 'phone' => '0661112233', 'name' => 'Yacine Cancel']))->tracking;
        $run('cancel_fresh', 'cancel', ['tracking' => $t2], fn($ad) => $ad->cancelParcel($t2), $c['good'], $sim);
        $sim = ($c['sim'])(); [, , $ad0] = $mk($c['good'], $sim);
        $t3 = $ad0->createParcel($P(['order_ref' => 'G-can2', 'phone' => '0661112244', 'name' => 'Amine Cancel']))->tracking;
        $after = ['yalidine' => 'Expédié', 'maystro' => '31'][$code] ?? null;
        if ($after !== null) { $sim->setStatus($t3, $after); }
        $run('cancel_after_dispatch', 'cancel', ['tracking' => $t3], fn($ad) => $ad->cancelParcel($t3), $c['good'], $sim);
        if ($code === 'dhd' || $code === 'noest') {
            $sim = ($c['sim'])(); [, , $ad0] = $mk($c['good'] + ['autoValidate' => '0'], $sim);
            $t4 = $ad0->createParcel($P(['order_ref' => 'G-can3']))->tracking;
            $run('cancel_draft', 'cancel', ['tracking' => $t4], fn($ad) => $ad->cancelParcel($t4), $c['good'], $sim, ['autoValidate' => '0']);
        }
        if ($code === 'yalidine') {
            $pay = ['type' => 'parcel_status_updated', 'data' => [['tracking' => 'yal-1AB', 'last_status' => 'Livré', 'order_id' => 'G1'], ['tracking' => 'yal-2AB', 'last_status' => ['name' => 'Tentative échouée']]]];
            $ad = ShippingFactory::make('yalidine', new RecSim(new YalidineSim()))->authenticate($c['good']);
            $steps[] = ['name' => 'webhook', 'op' => 'webhook', 'arg' => $pay, 'cred' => $c['good'], 'calls' => [], 'result' => array_map(fn($e) => ['tracking' => $e->tracking, 'rawStatus' => $e->rawStatus, 'status' => $e->status, 'orderRef' => $e->orderRef], $ad->parseWebhook($pay, []))];
        }
        /* ═══ المعايرة عند أول ربط: اكتشاف الحساب وبناء الملف ثم الإرسال بالملف (كتالوجنا بتهجئة مخالفة لكتالوج الشركة عمداً) ═══ */
        $oursArr = [16 => ['Alger Centre', 'Bab-Ezzouar', 'Kouba', 'Bordj El Kiffan', 'El Harrach', 'Zeralda'], 31 => ['Oran', 'Es Senia'], 32 => ['El Bayadh'], 17 => ['Djelfa', 'Ain Ouessara']];
        $theirs = [16 => ['Alger Centre', 'Bab Ezzouar', 'Kouba', 'Bordj El Kiffane', 'El Harrach', 'Rouiba'], 31 => ['Oran', 'Es Senia'], 32 => ['El Bayadh'], 17 => ['Djelfa', 'Aïn Oussera']];
        $prep = function () use ($c, $theirs, $code): Sim {
            $sim = ($c['sim'])(); $sim->catalog = $theirs;
            if ($code === 'yalidine') {
                $sim->closed = ['El Harrach'];
                $sim->centers = [16 => [['center_id' => 161601, 'name' => 'Bab Ezzouar Desk', 'address' => 'x', 'commune_name' => 'Bab Ezzouar', 'wilaya_id' => 16]]];
                foreach (['Livré', 'Retourné au vendeur', 'Statut Jamais Vu 77', 'Sorti en livraison'] as $i => $st) { $sim->setStatus('ext-' . $i, $st); }
            }
            return $sim;
        };
        $sim = $prep(); $rec = new RecSim($sim);
        $adC = ShippingFactory::make($code, $rec)->authenticate($c['good']);
        $prof = (new Calibrator(new OurGeo($oursArr), 10))->run($adC);
        unset($prof['at']);
        $profJson = json_decode(json_encode($prof, JSON_UNESCAPED_UNICODE), true);
        $steps[] = ['name' => 'calibrate', 'op' => 'calibrate', 'arg' => ['ours' => $oursArr, 'chunk' => 10], 'cred' => $c['good'], 'calls' => $rec->rec, 'result' => $profJson];
        $pl = [['Bab-Ezzouar', 16], ['Bordj El Kiffan', 16], ['Zeralda', 16], ['El Harrach', 16], ['Ain Ouessara', 17]];
        foreach ($pl as $i => [$cm, $wl]) {
            $a = ['commune' => $cm, 'wilaya' => $wl, 'order_ref' => 'G-cal' . $i];
            $sim = $prep(); $rec = new RecSim($sim); $ad = ShippingFactory::make($code, $rec)->authenticate($c['good'])->withProfile($profJson);
            $res = $cre($ad->createParcel($P($a)));
            $steps[] = ['name' => 'create_calibrated_' . $cm, 'op' => 'create_profile', 'arg' => $a + $base, 'profile' => $profJson, 'cred' => $c['good'], 'calls' => $rec->rec, 'result' => $res];
        }
        if ($code === 'yalidine') {
            $a = ['commune' => 'Kouba', 'stop_desk' => true, 'desk_id' => 999999, 'order_ref' => 'G-cald'];
            $sim = $prep(); $rec = new RecSim($sim); $ad = ShippingFactory::make($code, $rec)->authenticate($c['good'])->withProfile($profJson);
            $res = $cre($ad->createParcel($P($a)));
            $steps[] = ['name' => 'create_calibrated_bad_desk', 'op' => 'create_profile', 'arg' => $a + $base, 'profile' => $profJson, 'cred' => $c['good'], 'calls' => $rec->rec, 'result' => $res];
            $sim = $prep(); $rec = new RecSim($sim); $ad = ShippingFactory::make($code, $rec)->authenticate($c['good'] + ['webhookSecret' => 'shh'])->withProfile($profJson);
            $body = json_encode(['type' => 'parcel_status_updated', 'data' => [['tracking' => 'x', 'last_status' => 'Livré']]]);
            $steps[] = ['name' => 'webhook_signature', 'op' => 'verify_webhook', 'arg' => ['body' => $body, 'secret' => 'shh', 'sig' => hash_hmac('sha256', $body, 'shh')], 'cred' => $c['good'] + ['webhookSecret' => 'shh'], 'calls' => [],
                'result' => [$ad->verifyWebhook($body, []), $ad->verifyWebhook($body, ['x-yalidine-signature' => 'bad']), $ad->verifyWebhook($body, ['x-yalidine-signature' => hash_hmac('sha256', $body, 'shh')]), $ad->verifyWebhook($body, ['x-hub-signature-256' => 'sha256=' . hash_hmac('sha256', $body, 'shh')])]];
        }
        $out[$code] = $steps;
    }
    return $out;
}
