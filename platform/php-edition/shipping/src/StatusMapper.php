<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** ترجمة حالات الشركات إلى حالاتنا الموحَّدة. القواعد مرتَّبة: الأخصّ أولاً (مثلاً «échec livraison» قبل «livraison»). */
final class StatusMapper
{
    /** @var list<array{0:string,1:string}> نمط ← حالة؛ يُطبَّق على النص بعد التطبيع (أحرف صغيرة بلا تشكيل). */
    private const RULES = [
        ['/annul|cancel|supprim/', Status::CANCELLED],
        ['/tentative.*(echou|echec|fail)|echec (de )?livraison|injoignable|ne repond pas|no answer|client absent|reporte|failed/', Status::FAILED_ATTEMPT],
        ['/retour|retourne|returned|return |^return|refus|rejet/', Status::RETURNED],
        ['/en livraison|sorti en livraison|out for delivery|livraison en cours|en cours de livraison|en cours de distribution|pret pour livreur/', Status::OUT_FOR_DELIVERY],
        ['/^livre|livree|delivered|encaisse|paye|paid/', Status::DELIVERED],
        ['/pas encore|en attente de ramassage|a ramasser|a verifier|pret a expedier|en preparation|preparation|prepar|nouveau|nouvelle|^new|created|cree|pending|en attente|validee?|confirmee?/', Status::PENDING],
        ['/expedie|transfert|transit|centre|localisation|vers wilaya|recu a|ramasse|prise en charge|arrive|dispatch|en route|shipped|picked|hub|sortie|en cours/', Status::SHIPPED],
    ];

    /** تطبيع موحّد (يطابقه normalizeKey في بوابة JS): حروف صغيرة، بلا تشكيل، فراغ بدل _ و-، حذف «( رقم )» والأقواس. */
    public static function normalize(string $raw): string
    {
        $t = strtr(mb_strtolower(trim($raw)), ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'û' => 'u', 'ù' => 'u', 'ü' => 'u', 'ç' => 'c', 'œ' => 'oe']);
        $t = (string)preg_replace('/\(\s*\d+\s*\)/', ' ', $t);
        $t = str_replace(['_', '-', '[', ']', '(', ')'], ' ', $t);
        return trim((string)preg_replace('/\s+/', ' ', $t));
    }

    /** @var array<string,array<string,mixed>>|null */
    private static ?array $dict = null;
    /** مصدر آخر ترجمة: exact|code|event_key|fallback|unknown|empty */
    public static string $lastSource = 'empty';

    /** @return array<string,array<string,mixed>> القواميس بمفاتيح مطبَّعة */
    public static function dictionary(): array
    {
        if (self::$dict !== null) { return self::$dict; }
        $file = __DIR__ . '/../data/status-dict.json';
        $raw = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
        $out = [];
        foreach ((is_array($raw) ? $raw : []) as $carrier => $d) {
            if (!is_array($d) || str_starts_with((string)$carrier, '_')) { continue; }
            $e = ['exact' => [], 'codes' => [], 'event_key' => []];
            foreach ((array)($d['exact'] ?? []) as $k => $v) { $e['exact'][self::normalize((string)$k)] = (string)$v; }
            foreach ((array)($d['codes'] ?? []) as $k => $v) { $e['codes'][(string)$k] = (string)$v; }
            foreach ((array)($d['event_key'] ?? []) as $k => $v) { $e['event_key'][self::normalize((string)$k)] = (string)$v; }
            $out[(string)$carrier] = $e;
        }
        return self::$dict = $out;
    }

    /** الحالة وفق قاموس الشركة الصريح أولاً، ثم القواعد العامة كاحتياط. @return array{0:string,1:string} [الحالة، المصدر] ('ignore' حدث غير حالة) */
    public static function explain(string $carrier, string $raw): array
    {
        $t = self::normalize($raw);
        if ($t === '') { return [Status::UNKNOWN, 'empty']; }
        $d = self::dictionary()[$carrier] ?? null;
        if ($d) {
            if (isset($d['exact'][$t])) { return [$d['exact'][$t], 'exact']; }
            if (isset($d['event_key'][$t])) { return [$d['event_key'][$t], 'event_key']; }
            if (isset($d['codes'][trim($raw)])) { return [$d['codes'][trim($raw)], 'code']; }
        }
        foreach (self::RULES as [$re, $st]) { if (preg_match($re, $t)) { return [$st, 'fallback']; } }
        return [Status::UNKNOWN, 'unknown'];
    }

    /** $carrier عائلة المنصة (yalidine, zrexpress, maystro, noest, ecotrack). 'ignore' يُحوَّل إلى unknown (لا يطبَّق). */
    public static function map(string $carrier, string $raw): string
    {
        [$st, $src] = self::explain($carrier, $raw);
        self::$lastSource = $src;
        return $st === 'ignore' ? Status::UNKNOWN : $st;
    }
}
