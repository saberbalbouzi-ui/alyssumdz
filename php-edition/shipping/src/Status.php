<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** الحالات الموحَّدة التي يراها التاجر مهما كانت الشركة. */
final class Status
{
    public const PENDING = 'pending';                 // أُنشئ الطرد ولم يُستلم من التاجر بعد
    public const SHIPPED = 'shipped';                 // استُلم وهو في الطريق (مراكز/نقل)
    public const OUT_FOR_DELIVERY = 'out_for_delivery'; // خرج للتسليم
    public const DELIVERED = 'delivered';
    public const FAILED_ATTEMPT = 'failed_attempt';   // محاولة تسليم فاشلة (لم يُغلق الطرد)
    public const RETURNED = 'returned';               // مرتجع (قيد الإرجاع أو وصل للتاجر)
    public const CANCELLED = 'cancelled';
    public const UNKNOWN = 'unknown';

    public const ALL = [self::PENDING, self::SHIPPED, self::OUT_FOR_DELIVERY, self::DELIVERED, self::FAILED_ATTEMPT, self::RETURNED, self::CANCELLED, self::UNKNOWN];

    /** حالات نهائية: لا يُغيَّر بعدها شيء (تتفادى تراجع حالة بسبب رسالة متأخرة). */
    public const FINAL = [self::DELIVERED, self::RETURNED, self::CANCELLED];

    private const RANK = [self::PENDING => 0, self::SHIPPED => 1, self::OUT_FOR_DELIVERY => 2, self::FAILED_ATTEMPT => 2];

    /** هل يجوز الانتقال من $from إلى $to؟ (لا رجوع للخلف، النهائي لا يتغيّر، المجهول لا يطبَّق). */
    public static function canTransition(string $from, string $to): bool
    {
        if ($to === self::UNKNOWN || $from === $to || in_array($from, self::FINAL, true)) { return false; }
        if (in_array($to, self::FINAL, true)) { return true; }
        return (self::RANK[$to] ?? -1) > (self::RANK[$from] ?? -1) || ($from === self::FAILED_ATTEMPT && $to === self::OUT_FOR_DELIVERY);
    }
}
