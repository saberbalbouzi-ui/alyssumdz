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

    /** يحقن ملف معايرة الحساب (نتيجة Calibrator): خريطة البلديات الصحيحة، المكاتب، تصحيحات الحالات. */
    public function withProfile(array $profile): static;

    /**
     * التقاط بيانات حساب الشركة بقراءة فقط (لا ينشئ شيئاً): بلديات الولايات المطلوبة، المكاتب، التعريفة، حالات الطرود الموجودة.
     * @param list<int> $wilayas ولايات قديمة (1–58) للجزء الجغرافي @param array<string,bool> $want communes|desks|fees|statuses
     * @return array{communes:array<int,list<array{name:string,id?:int|string,deliverable?:bool}>>,desks:array<int,list<array{id:string,name:string,commune:string}>>,fees:array<int,array{home:int,stop:int}>,statuses:array<string,int>,trackings:list<string>,notes:list<string>}
     */
    public function discover(array $wilayas, array $want = []): array;

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

    /** كيف تُترجم حالة خام: [الحالة الموحدة، المصدر exact|code|event_key|override|fallback|unknown|empty]. @return array{0:string,1:string} */
    public function explainStatus(string $rawStatus): array;

    /** التحقق من توقيع الـwebhook إن زوّد التاجر سرّ التوقيع: null = لا سرّ مضبوط (لا تحقق)، true/false = صحيح/خاطئ. @param array<string,string> $headers */
    public function verifyWebhook(string $rawBody, array $headers): ?bool;


    /**
     * يستخرج أحداث الحالة من جسم webhook الوارد (بلا حاجة إلى مفاتيح التاجر).
     * @param array<string,mixed> $payload @param array<string,string> $headers (أسماء صغيرة)
     * @return list<WebhookEvent>
     */
    public function parseWebhook(array $payload, array $headers): array;
}
