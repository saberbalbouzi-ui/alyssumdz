<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

use Alyssum\Shipping\Adapters\{EcotrackAdapter, MaystroAdapter, NoestAdapter, YalidineAdapter, ZRExpressAdapter};

/**
 * سجلّ الشركات: ما تدعمه المنصة وكيف يُوجَّه كل منها. يستعمله المصنع وواجهة «وسائل التوصيل» عند عرض القائمة.
 * maturity: documented (مبنية على توثيق/تكامل قائم) | experimental (لم تُجرَّب على حساب حقيقي) | planned (لا محوّل بعد).
 * base_verified=false تعني أن الرابط الأساسي غير مؤكَّد، فيُطلب من التاجر إدخال رابط منصته بنفسه.
 */
final class CarrierRegistry
{
    /** @var array<string,array<string,mixed>> */
    public const CARRIERS = [
        'yalidine'      => ['label' => 'Yalidine',                 'adapter' => YalidineAdapter::class,   'maturity' => 'documented'],
        'zrexpress'     => ['label' => 'ZR Express',               'adapter' => ZRExpressAdapter::class,  'maturity' => 'experimental', 'aliases' => ['zr', 'procolis']],
        'maystro'       => ['label' => 'Maystro Delivery',         'adapter' => MaystroAdapter::class,    'maturity' => 'experimental'],
        'noest'         => ['label' => 'NOEST Express',            'adapter' => NoestAdapter::class,      'maturity' => 'experimental'],
        // عائلة Ecotrack: محوّل واحد، رابط مختلف لكل شركة
        'ecotrack'      => ['label' => 'Ecotrack (منصة عامة)',     'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        'dhd'           => ['label' => 'DHD Livraison',            'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => 'https://dhd.ecotrack.dz',     'base_verified' => true,  'aliases' => ['dhd_livraison']],
        'conexlog'      => ['label' => 'Conexlog',                 'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        'zimou'         => ['label' => 'Zimou Express',            'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        'hhd'           => ['label' => 'HHD Express',              'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        'anderson'      => ['label' => 'Anderson Delivery',        'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        'ecom_delivery' => ['label' => 'E-com Delivery',           'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        'elogistia'     => ['label' => 'Elogistia',                'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        '48h'           => ['label' => '48H Express',              'adapter' => EcotrackAdapter::class,   'maturity' => 'experimental', 'base' => null,                          'base_verified' => false],
        // لا محوّل: لا توثيق عام مؤكَّد
        'mylers'        => ['label' => 'Mylers',                   'adapter' => null,                     'maturity' => 'planned'],
    ];

    public static function resolve(string $code): ?string
    {
        $c = strtolower(trim($code));
        if (isset(self::CARRIERS[$c])) { return $c; }
        foreach (self::CARRIERS as $k => $meta) { if (in_array($c, $meta['aliases'] ?? [], true)) { return $k; } }
        return null;
    }

    /** @return array<string,mixed>|null */
    public static function meta(string $code): ?array { $k = self::resolve($code); return $k ? self::CARRIERS[$k] + ['code' => $k] : null; }

    /** قائمة للواجهة: ما يمكن تفعيله الآن. @return list<array<string,mixed>> */
    public static function catalog(): array
    {
        $out = [];
        foreach (self::CARRIERS as $code => $m) {
            $fields = $m['adapter'] ? $m['adapter']::credentialFields() : [];
            $out[] = ['code' => $code, 'label' => $m['label'], 'maturity' => $m['maturity'], 'activatable' => $m['adapter'] !== null, 'needs_base_url' => ($m['adapter'] === EcotrackAdapter::class) && empty($m['base']), 'fields' => $fields];
        }
        return $out;
    }
}
