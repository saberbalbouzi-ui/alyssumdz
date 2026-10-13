<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** العقد الموحَّد: كل شركة توصيل تُنفّذه ولا يعرف بقية النظام شيئاً عن تفاصيلها. */
interface ShippingInterface
{
    /** المفتاح الثابت للشركة (yalidine, zrexpress, …). */
    public function code(): string;

    /** الحقول التي يدخلها التاجر لتفعيل الشركة: [['key'=>'apiId','label'=>'API ID','secret'=>false], …]. */
    public static function credentialFields(): array;

    /** يحقن مفاتيح التاجر (بعد فكّ تشفيرها). يُرمى CredentialsException إن نقص حقل مطلوب. @param array<string,string> $credentials */
    public function authenticate(array $credentials): static;

    /** فحص المفاتيح بطلب قراءة فقط (لا ينشئ طرداً): ok=true صالحة، false مرفوضة، null تعذّر الحكم (شبكة/غير مدعوم). @return array{ok:?bool,message:string} */
    public function ping(): array;

    public function createParcel(Parcel $parcel): ShipmentResult;

    public function trackParcel(string $tracking): TrackingResult;

    /** يلغي الطرد عند الشركة؛ false إن رفضت (مثلاً بعد خروجه). */
    public function cancelParcel(string $tracking): bool;

    /** رابط بوليصة الشحن (PDF/صفحة) إن توفّر. */
    public function labelUrl(string $tracking): ?string;

    /** قائمة ولايات الشركة إن كانت تعرضها، وإلا الكتالوج الموحّد. @return list<array{code:int,name:string,parent:?int}> */
    public function wilayas(): array;

    /** ترجمة حالة الشركة النصية إلى الحالات الموحَّدة (انظر Status). */
    public function mapStatus(string $rawStatus): string;

    /**
     * يستخرج أحداث الحالة من جسم webhook الوارد (بلا حاجة إلى مفاتيح التاجر).
     * @param array<string,mixed> $payload @param array<string,string> $headers (أسماء صغيرة)
     * @return list<WebhookEvent>
     */
    public function parseWebhook(array $payload, array $headers): array;
}
