<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** كتالوجنا للولايات والبلديات (للمقارنة مع كتالوج الشركة عند المعايرة). الولايات 59–69 تُدمج تحت أمّها لأن الشركات ما زالت تسجّلها هناك. */
final class OurGeo
{
    /** @param array<int,list<string>> $byLegacy ولاية قديمة (1–58) ← أسماء بلدياتها عندنا */
    public function __construct(private array $byLegacy) { ksort($this->byLegacy); }

    public static function load(?string $file = null): self
    {
        $file ??= __DIR__ . '/../data/geo.json';
        $j = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
        $out = [];
        foreach ((array)($j['wilayas'] ?? []) as $w) {
            $legacy = (int)($w['parent'] ?? 0) ?: (int)$w['code'];
            foreach ((array)($w['communes'] ?? []) as $c) { $out[$legacy][] = (string)$c; }
        }
        return new self($out);
    }

    /** @return list<int> */ public function wilayas(): array { return array_keys($this->byLegacy); }
    /** @return list<string> */ public function communes(int $legacy): array { return $this->byLegacy[$legacy] ?? []; }
}
