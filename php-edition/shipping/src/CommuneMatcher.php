<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** مطابقة اسم البلدية مع قائمة الشركة (معرّفات رقمية أو تهجئة مختلفة): تطبيع ثم مطابقة تامة ثم الأقرب بحدّ أدنى للثقة. */
final class CommuneMatcher
{
    public static function normalize(string $s): string
    {
        $t = strtr(mb_strtolower(trim($s)), ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'û' => 'u', 'ù' => 'u', 'ü' => 'u', 'ç' => 'c', 'œ' => 'oe', 'ʿ' => "'", '’' => "'"]);
        $t = (string)preg_replace("/[\\-_'`.,()]+/u", ' ', $t);
        $t = (string)preg_replace('/\\bouled\\b/u', 'oulad', $t);
        $t = (string)preg_replace('/\\b(el|el-|al|ben)\\s+/u', '$1', $t);                 // «El Harrach» = «Elharrach»
        $t = str_replace(['ou', 'ee'], ['u', 'i'], $t);                                   // Boughzoul/Boughezoul، Oussera/Ouessara بعد حذف الحروف اللينة
        $t = (string)preg_replace('/(?<=\\p{L})[aeiouy](?=\\p{L})/u', '', $t);            // مقارنة بالصامت فقط تتحمل الفروق الإملائية
        return trim((string)preg_replace('/\\s+/', '', $t));
    }

    /**
     * @param list<array{id:int|string,name:string}> $candidates
     * @return array{id:int|string,name:string,score:float}|null
     */
    public static function best(array $candidates, string $name, float $min = 0.82): ?array
    {
        $n = self::normalize($name); if ($n === '') { return null; }
        $exact = null; $best = null; $bestScore = 0.0;
        foreach ($candidates as $c) {
            $cn = self::normalize((string)$c['name']);
            if ($cn === $n) { $exact = $exact ?? $c + ['score' => 1.0]; continue; }
            $max = max(strlen($n), strlen($cn)); if ($max === 0) { continue; }
            $score = 1 - levenshtein($n, $cn) / $max;
            if ($score > $bestScore) { $bestScore = $score; $best = $c + ['score' => round($score, 3)]; }
        }
        if ($exact) { return $exact; }
        return $best && $bestScore >= $min ? $best : null;
    }

    /** أقرب n أسماء (للرسالة التشخيصية عند الفشل). @param list<array{id:int|string,name:string}> $candidates @return list<string> */
    public static function suggest(array $candidates, string $name, int $n = 4): array
    {
        $x = self::normalize($name); $sc = [];
        foreach ($candidates as $c) { $sc[(string)$c['name']] = levenshtein($x, self::normalize((string)$c['name'])); }
        asort($sc); return array_slice(array_keys($sc), 0, $n);
    }
}
