<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

use Alyssum\Shipping\Adapters\EcotrackAdapter;
use Alyssum\Shipping\Http\{CurlHttpClient, HttpClient};

/** المصنع: يعيد المحوّل الصحيح لاسم الشركة. شركات Ecotrack كلها تُوجَّه إلى EcotrackAdapter برابطها الخاص. */
final class ShippingFactory
{
    public static function make(string $carrier, ?HttpClient $http = null, ?string $baseUrlOverride = null): ShippingInterface
    {
        $meta = CarrierRegistry::meta($carrier);
        if ($meta === null) { throw new UnsupportedCarrierException("شركة غير معروفة: $carrier"); }
        $class = $meta['adapter'];
        if ($class === null) { throw new UnsupportedCarrierException($meta['label'] . ' غير مدعومة بعد (لا توثيق API مؤكَّد)'); }
        $http ??= new CurlHttpClient();
        if ($class === EcotrackAdapter::class) {
            return new EcotrackAdapter($http, $meta['code'], (string)($baseUrlOverride ?: ($meta['base'] ?? '')));
        }
        return new $class($http);
    }

    /** محوّل لقراءة webhook فقط (لا يحتاج مفاتيح التاجر). */
    public static function forWebhook(string $carrier, ?HttpClient $http = null): ShippingInterface { return self::make($carrier, $http); }
}
