<?php
declare(strict_types=1);
namespace Alyssum\Gateway;

/** كتالوج الولايات (1..69) والبلديات ومكاتب Stop Desk + مطابقة تهجئة البلدية (أخطاء الإملاء سبب أول لرفض الطرود). */
final class Geo
{
    /** @var array<int,array{code:int,name:string,parent:?int,communes:list<string>,desks:list<array<string,string>>}> */
    private array $w = [];
    /** @var array<int,array<string,string>> code ← [مطبَّع ← الأصل] */
    private array $idx = [];

    public function __construct(?string $file = null)
    {
        $j = json_decode((string)file_get_contents($file ?? __DIR__ . '/../data/geo.json'), true);
        foreach ((array)($j['wilayas'] ?? []) as $w) {
            $c = (int)$w['code']; $this->w[$c] = $w;
            foreach ($w['communes'] as $n) { $this->idx[$c][self::norm($n)] = $n; }
        }
        // الولايات الجديدة (59–69): شركات التوصيل ما زالت تسجّل بلدياتها تحت الولاية الأم (تحقّقنا من 1541 بلدية عند ياليدين)،
        // فيجب أن تُقبل بلديتها حين يختار الزبون الولاية الأم أيضاً.
        foreach ($this->w as $c => $w) {
            $par = $w['parent'] ?? null;
            if ($par !== null && isset($this->w[(int)$par])) { foreach ($w['communes'] as $n) { $this->idx[(int)$par][self::norm($n)] ??= $n; } }
        }
    }

    public static function norm(string $s): string
    {
        $s = strtr(mb_strtolower(trim($s)), ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', 'œ' => 'oe', '’' => "'", 'ï' => 'i']);
        return (string)preg_replace('/[^a-z0-9\x{0600}-\x{06FF}]+/u', '', $s);
    }

    /** @return list<array<string,mixed>> الولايات التي تقبلها الشركات (≤58) أو الكل. */
    public function wilayas(bool $all = false): array
    {
        $o = [];
        foreach ($this->w as $c => $w) {
            if (!$all && $w['parent'] !== null) { continue; }
            $o[] = ['code' => $c, 'name' => $w['name'], 'shipAs' => $w['parent'] ?? $c, 'courierSupported' => $w['parent'] === null, 'communes' => count($w['communes'])];
        }
        return $o;
    }

    public function wilaya(int $code): ?array { return $this->w[$code] ?? null; }

    /** @return list<string> */
    public function communes(int $code): array { return $this->w[$code]['communes'] ?? []; }

    /** @return list<array<string,string>> */
    public function desks(int $code): array { return $this->w[$code]['desks'] ?? []; }

    /** @return list<array{wilaya:int,commune:string}> بحث نصي */
    public function searchCommunes(string $q, int $limit = 50): array
    {
        $n = self::norm($q); $o = [];
        if ($n === '') { return $o; }
        foreach ($this->idx as $c => $m) { foreach ($m as $k => $orig) { if (str_contains($k, $n)) { $o[] = ['wilaya' => $c, 'commune' => $orig]; if (count($o) >= $limit) { return $o; } } } }
        return $o;
    }

    /**
     * @return array{status:string,commune:?string,suggestions:list<string>}
     *   exact: مطابقة تامة (بعد تطبيع الحروف) | corrected: أقرب مرشح وحيد بفارق صغير | unknown: مع اقتراحات
     */
    public function matchCommune(int $wilaya, string $name): array
    {
        $m = $this->idx[$wilaya] ?? null; $n = self::norm($name);
        if ($m === null) { return ['status' => 'unknown_wilaya', 'commune' => null, 'suggestions' => []]; }
        if ($n === '') { return ['status' => 'unknown', 'commune' => null, 'suggestions' => []]; }
        if (isset($m[$n])) { return ['status' => 'exact', 'commune' => $m[$n], 'suggestions' => []]; }
        $scored = [];
        foreach ($m as $k => $orig) {
            $d = levenshtein($n, $k); $contain = str_contains($k, $n) || str_contains($n, $k);
            $limit = max(1, intdiv(max(strlen($n), strlen($k)), 5));
            if ($d <= $limit || ($contain && min(strlen($n), strlen($k)) >= 4)) { $scored[$orig] = $d; }
        }
        asort($scored);
        $sug = array_slice(array_keys($scored), 0, 5);
        if (count($scored) >= 1) {
            $best = (int)reset($scored); $ties = count(array_filter($scored, fn($d) => $d === $best));
            if ($ties === 1 && $best <= 1) { return ['status' => 'corrected', 'commune' => $sug[0], 'suggestions' => $sug]; }
        }
        return ['status' => 'unknown', 'commune' => null, 'suggestions' => $sug];
    }
}
