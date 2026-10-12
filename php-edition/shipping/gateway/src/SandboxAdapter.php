<?php
declare(strict_types=1);
namespace Alyssum\Gateway;

use Alyssum\Shipping\{AbstractAdapter, CarrierApiException, Parcel, ShipmentResult, Status, TrackingResult};
use Alyssum\Shipping\Http\HttpClient;

/** شركة وهمية للتجربة: تتحقق من الحقول كما تفعل شركة حقيقية، ولا تنشئ طرداً، ولا تحتاج مفاتيح. الحالة حتمية من رقم التتبع (للاختبار). */
final class SandboxAdapter extends AbstractAdapter
{
    private const FLOW = [['pending', 'created'], ['shipped', 'in_transit'], ['out_for_delivery', 'out_for_delivery'], ['delivered', 'delivered']];

    public function __construct(HttpClient $http, private Geo $geo) { parent::__construct($http); }

    public function code(): string { return 'sandbox'; }
    public static function credentialFields(): array { return []; }

    public function createParcel(Parcel $p): ShipmentResult
    {
        $err = [];
        if (!preg_match('/^0[567]\d{8}$/', $p->localPhone())) { $err[] = 'رقم الهاتف غير صالح'; }
        if (mb_strlen($p->name) < 2 || mb_strlen($p->name) > 120) { $err[] = 'الاسم 2–120 حرفاً'; }
        if ($p->productsText() === '') { $err[] = 'قائمة المنتجات فارغة'; }
        if ($this->geo->matchCommune($p->wilayaCode, $p->commune)['status'] !== 'exact') { $err[] = 'بلدية غير معروفة في هذه الولاية'; }
        if ($p->stopDesk && !$p->deskId) { $err[] = 'مكتب Stop Desk غير محدد'; }
        if ($err) { return new ShipmentResult(false, error: implode('، ', $err)); }
        return new ShipmentResult(true, 'SBX-' . strtoupper(substr(sha1($p->orderRef), 0, 8)), null, '', ['sandbox' => true]);
    }

    public function trackParcel(string $tracking): TrackingResult
    {
        if (!preg_match('/^SBX-([0-9A-F]{8})$/', $tracking, $m)) { throw new CarrierApiException('رقم تتبع غير موجود'); }
        [$st, $raw] = self::FLOW[hexdec($m[1][7]) % 4];
        return new TrackingResult($tracking, $raw, $st, ['sandbox' => true]);
    }
}
