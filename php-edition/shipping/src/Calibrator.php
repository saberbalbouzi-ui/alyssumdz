<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/**
 * المعايرة عند أول ربط: يلتقط حساب الشركة بقراءة فقط (بلدياتها ومكاتبها وتعريفتها وحالات طرودها) ويقارنه بكتالوجنا، ثم يبني «ملف معايرة» يصحّح النظام قبل أن يعمل العميل:
 *  - خريطة البلديات (اسمنا ← الاسم الصحيح عند الشركة) وقائمة ما لا يمكن الإرسال إليه سلفاً؛
 *  - مكاتب Stop Desk الحقيقية، وتعريفة الحساب؛
 *  - تدقيق حالات الطرود الموجودة (المجهولة تُعلَن، والمترجمة بالاحتياط تُثبَّت صراحةً)؛
 *  - فحص أن محوّلنا يحلّل ردّ التتبع الحقيقي لطرود حقيقية.
 * حالة الآلة (start/step) تُخزَّن داخل الملف نفسه فيمكن تنفيذ المعايرة على دفعات بين طلبات HTTP قصيرة (Workers) أو دفعة واحدة (run).
 */
final class Calibrator
{
    public const V = 1;

    public function __construct(private OurGeo $geo, private int $chunk = 10) {}

    /** @return array<string,mixed> */
    public function start(ShippingInterface $ad): array
    {
        $ping = $ad->ping();
        $p = ['v' => self::V, 'carrier' => $ad->code(), 'at' => gmdate('c'), 'ping' => $ping, 'phase' => 'geo', 'pending' => $this->geo->wilayas(), 'communes' => [], 'desks' => [], 'fees' => [],
            'statuses' => [], 'status_overrides' => [], 'verify' => [], 'warnings' => [], 'notes' => [], 'done' => false];
        if ($ping['ok'] === false) { $p['phase'] = 'done'; $p['done'] = true; $p['warnings'][] = 'رفضت الشركة المفاتيح: ' . $ping['message']; }
        return $p;
    }

    /** ينفّذ دفعة واحدة ويُرجع الملف المحدَّث. @param array<string,mixed> $p @return array<string,mixed> */
    public function step(ShippingInterface $ad, array $p): array
    {
        if ($p['done']) { return $p; }
        if ($p['phase'] === 'geo') {
            $chunk = array_splice($p['pending'], 0, $this->chunk);
            $p = $this->mergeGeo($p, $chunk, $ad->discover($chunk, ['communes' => true, 'desks' => true]));
            if (!$p['pending']) {
                $failed = (array)($p['_failed'] ?? []); unset($p['_failed']);
                if ($failed && empty($p['retried'])) { $p['pending'] = $failed; $p['retried'] = true; }        // ولايات تعثّرت (حدّ المعدّل مثلاً): تُعاد مرة واحدة في آخر الدور
                else {
                    if ($failed) { $p['warnings'][] = 'تعذّر جلب بلديات الولايات: ' . implode('، ', array_slice($failed, 0, 12)) . (count($failed) > 12 ? '…' : '') . ' (ستُتحقَّق بلدياتها وقت الإرسال)'; }
                    $p['phase'] = 'meta';
                }
            }
            return $p;
        }
        if ($p['phase'] === 'meta') {
            $d = $ad->discover([], ['fees' => true, 'statuses' => true]);
            $p['fees'] = $d['fees'];
            $p = $this->auditStatuses($ad, $p, $d['statuses']);
            $p['_trk'] = $d['trackings'];
            foreach ($d['notes'] as $n) { if (!in_array($n, $p['notes'], true)) { $p['notes'][] = $n; } }
            $p['phase'] = 'verify';
            return $p;
        }
        // verify: يختبر تحليل ردّ التتبع الحقيقي على طرود حقيقية (قراءة فقط)
        $ok = 0; $fail = 0; $err = [];
        foreach ((array)($p['_trk'] ?? []) as $t) {
            try { $ad->withProfile($p)->trackParcel((string)$t); $ok++; }
            catch (CredentialsException $e) { throw $e; }
            catch (ShippingException $e) { $fail++; $err[] = mb_substr($e->getMessage(), 0, 140); }
        }
        unset($p['_trk']);
        $p['verify'] = ['track' => ['ok' => $ok, 'fail' => $fail, 'errors' => $err]];
        if ($fail > 0) { $p['warnings'][] = "تعذّر تحليل ردّ التتبع لـ{$fail} من " . ($ok + $fail) . ' طرد حقيقي (' . implode(' | ', array_slice($err, 0, 2)) . ') — أرسل تقرير المعايرة للدعم لتصحيح المحوّل'; }
        $p['phase'] = 'done'; $p['done'] = true; $p['at'] = gmdate('c');
        return $p;
    }

    /** @return array<string,mixed> */
    public function run(ShippingInterface $ad): array
    {
        $p = $this->start($ad);
        for ($i = 0; $i < 400 && !$p['done']; $i++) { $p = $this->step($ad, $p); }
        return $p;
    }

    /** @param array<string,mixed> $p @param list<int> $chunk @param array<string,mixed> $d @return array<string,mixed> */
    private function mergeGeo(array $p, array $chunk, array $d): array
    {
        foreach ($d['notes'] as $n) { if (!in_array($n, $p['notes'], true)) { $p['notes'][] = $n; } }
        $failed = [];
        foreach ($chunk as $w) {
            $theirs = $d['communes'][$w] ?? null;
            if ($theirs === null) { continue; }                                             // الشركة لا تعرض القوائم (ZR…)
            if (!$theirs) { $failed[] = $w; continue; }
            $byKey = []; $cand = []; $ids = []; $ambig = 0;
            foreach ($theirs as $t) {
                $k = CommuneMatcher::normalize((string)$t['name']);
                if (isset($byKey[$k])) { $ambig++; continue; }
                $byKey[$k] = $t; $cand[] = ['id' => $t['id'] ?? $k, 'name' => (string)$t['name']];
                if (isset($t['id'])) { $ids[$k] = $t['id']; }
            }
            $map = []; $unm = []; $fuzzy = []; $hit = [];
            foreach ($this->geo->communes($w) as $o) {
                $ko = CommuneMatcher::normalize($o);
                if (isset($byKey[$ko])) { $hit[$ko] = 1; if ((string)$byKey[$ko]['name'] !== $o) { $map[$ko] = (string)$byKey[$ko]['name']; } continue; }
                $m = CommuneMatcher::best($cand, $o);
                if ($m) { $map[$ko] = (string)$m['name']; $hit[CommuneMatcher::normalize((string)$m['name'])] = 1; $fuzzy[] = [$o, (string)$m['name'], $m['score']]; }
                else { $unm[] = $o; }
            }
            $und = [];
            foreach ($theirs as $t) {
                if (($t['deliverable'] ?? true) === false) {
                    $und[] = (string)$t['name'];
                    foreach ($map as $ko => $tn) { if ($tn === (string)$t['name']) { $und[] = $ko; } }
                }
            }
            $p['communes'][(string)$w] = ['n' => count($theirs), 'map' => $map, 'unmatched' => $unm, 'undeliverable' => array_values(array_unique($und)), 'fuzzy' => $fuzzy, 'ids' => $ids,
                'carrierOnly' => max(0, count($byKey) - count($hit)), 'ambiguous' => $ambig];
            if (!empty($d['desks'][$w])) { $p['desks'][(string)$w] = $d['desks'][$w]; }
        }
        if ($failed) { $p['_failed'] = array_values(array_unique(array_merge((array)($p['_failed'] ?? []), $failed))); }
        return $p;
    }

    /** @param array<string,mixed> $p @param array<string,int> $seen @return array<string,mixed> */
    private function auditStatuses(ShippingInterface $ad, array $p, array $seen): array
    {
        $unknown = [];
        foreach ($seen as $raw => $n) {
            [$u, $src] = $ad->explainStatus((string)$raw);
            $p['statuses'][(string)$raw] = ['u' => $u, 'src' => $src, 'n' => (int)$n];
            if ($src === 'unknown') { $unknown[] = $raw . ' ×' . $n; }
            elseif ($src === 'fallback' && $u !== Status::UNKNOWN) { $p['status_overrides'][StatusMapper::normalize((string)$raw)] = $u; }   // تثبيت صريح لما قُدِّر بالقواعد العامة
        }
        if ($unknown) { $p['warnings'][] = 'حالات موجودة في حسابك ولا يعرفها النظام (لن تُطبَّق على الطلبات حتى تُضاف): ' . implode('، ', array_slice($unknown, 0, 8)); }
        return $p;
    }

    /** ملخّص قصير يُعرض للعميل (بلا قوائم ضخمة). @param array<string,mixed> $p @return array<string,mixed> */
    public static function summary(array $p): array
    {
        $c = ['wilayas' => 0, 'mapped' => 0, 'unmatched' => 0, 'undeliverable' => 0, 'fuzzy' => 0, 'carrierOnly' => 0]; $ex = [];
        foreach ((array)($p['communes'] ?? []) as $w => $x) {
            $c['wilayas']++; $c['mapped'] += count($x['map']); $c['unmatched'] += count($x['unmatched']); $c['undeliverable'] += count($x['undeliverable']);
            $c['fuzzy'] += count($x['fuzzy']); $c['carrierOnly'] += (int)$x['carrierOnly'];
            foreach ($x['unmatched'] as $u) { if (count($ex) < 8) { $ex[] = $u; } }
        }
        $st = ['seen' => count((array)($p['statuses'] ?? [])), 'unknown' => 0, 'learned' => count((array)($p['status_overrides'] ?? []))];
        foreach ((array)($p['statuses'] ?? []) as $s) { if (($s['src'] ?? '') === 'unknown') { $st['unknown']++; } }
        return ['carrier' => $p['carrier'] ?? '', 'at' => $p['at'] ?? '', 'done' => (bool)($p['done'] ?? false), 'phase' => $p['phase'] ?? '', 'ping' => $p['ping'] ?? null,
            'progress' => ['left' => count((array)($p['pending'] ?? [])), 'phase' => $p['phase'] ?? ''],
            'communes' => $c, 'unmatched_examples' => $ex, 'desks' => array_sum(array_map('count', (array)($p['desks'] ?? []))), 'fees' => count((array)($p['fees'] ?? [])),
            'statuses' => $st, 'verify' => $p['verify']['track'] ?? null, 'warnings' => $p['warnings'] ?? [], 'notes' => $p['notes'] ?? [], 'webhook' => $p['webhook'] ?? null];
    }
}
