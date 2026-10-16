<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** الكائن الموحَّد للطرد: تبنيه المنصة مرة واحدة ويترجمه كل محوّل إلى صيغة شركته. */
final class Parcel
{
    public function __construct(
        public readonly string $orderRef,          // رقم طلب المتجر (مفتاح عدم التكرار)
        public readonly string $name,
        public readonly string $phone,
        public readonly int $wilayaCode,           // DZ-01..DZ-69
        public readonly string $commune,
        public readonly string $address,
        public readonly float $total,              // المبلغ المطلوب تحصيله عند التسليم (COD) شاملاً التوصيل
        public readonly float $shippingFee = 0.0,
        public readonly string $products = '',
        public readonly string $phone2 = '',
        public readonly bool $stopDesk = false,
        public readonly ?int $deskId = null,       // معرّف مكتب Stop Desk عند الشركة إن لزم
        public readonly string $note = '',
        public readonly bool $canOpen = true,
        public readonly string $deskCode = '',     // رمز المكتب النصي عند الشركات التي تستعمله (NOEST: 16A، Ecotrack: code_postal)
    ) {
        if (trim($orderRef) === '') { throw new \InvalidArgumentException('orderRef مطلوب'); }
        if (WilayaCatalog::name($wilayaCode) === null) { throw new \InvalidArgumentException("ولاية غير معروفة: $wilayaCode"); }
        if ($total < 0 || $total > 10_000_000) { throw new \InvalidArgumentException('المبلغ خارج الحدود'); }
    }

    /** @param array<string,mixed> $a */
    public static function fromArray(array $a): self
    {
        return new self(
            orderRef: (string)($a['order_ref'] ?? $a['id'] ?? ''), name: trim((string)($a['name'] ?? '')), phone: (string)($a['phone'] ?? ''),
            wilayaCode: (int)($a['wilaya'] ?? $a['wilaya_code'] ?? 0), commune: trim((string)($a['commune'] ?? '')), address: trim((string)($a['address'] ?? '')),
            total: (float)($a['total'] ?? 0), shippingFee: (float)($a['fee'] ?? $a['shipping_fee'] ?? 0), products: (string)($a['products'] ?? $a['items'] ?? ''),
            phone2: (string)($a['phone2'] ?? ''), stopDesk: (bool)($a['stop_desk'] ?? (($a['dtype'] ?? '') === 'stop')),
            deskId: isset($a['desk_id']) ? (int)$a['desk_id'] : null, note: (string)($a['note'] ?? ''), canOpen: (bool)($a['can_open'] ?? true), deskCode: trim((string)($a['desk_code'] ?? '')),
        );
    }

    public function wilayaName(): string { return (string)WilayaCatalog::name($this->wilayaCode); }

    /** ولاية الشركات القديمة (58): الأم للولايات الجديدة. */
    public function legacyWilaya(): int { return WilayaCatalog::legacyCode($this->wilayaCode); }

    /** الهاتف بصيغة محلية 0XXXXXXXXX. */
    public function localPhone(string $p = null): string
    {
        $d = preg_replace('/\D/', '', $p ?? $this->phone) ?? '';
        if (str_starts_with($d, '213')) { $d = '0' . substr($d, 3); } elseif (strlen($d) === 9) { $d = '0' . $d; }
        return $d;
    }

    /** @return array{0:string,1:string} الاسم الأول واسم العائلة (نقطة مكان الناقص). */
    public function nameParts(): array
    {
        $p = preg_split('/\s+/', trim($this->name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        return [$p[0] ?? '.', implode(' ', array_slice($p, 1)) ?: '.'];
    }

    public function productsText(int $max = 250): string
    {
        $t = trim((string)preg_replace('/\s*=\s*\d+\s*DA\s*/i', '', str_replace("\n", '، ', $this->products)));
        return function_exists('mb_substr') ? mb_substr($t, 0, $max) : substr($t, 0, $max);
    }

    /** السعر بلا التوصيل. */
    public function priceWithoutShipping(): int { return (int)max(0, round($this->total - $this->shippingFee)); }
}
