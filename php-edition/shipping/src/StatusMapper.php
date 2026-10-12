<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** ترجمة حالات الشركات إلى حالاتنا الموحَّدة. القواعد مرتَّبة: الأخصّ أولاً (مثلاً «échec livraison» قبل «livraison»). */
final class StatusMapper
{
    /** @var list<array{0:string,1:string}> نمط ← حالة؛ يُطبَّق على النص بعد التطبيع (أحرف صغيرة بلا تشكيل). */
    private const RULES = [
        ['/annul|cancel|supprim/', Status::CANCELLED],
        ['/tentative.*(echou|echec|fail)|echec (de )?livraison|injoignable|ne repond pas|no answer|client absent|reporte|failed/', Status::FAILED_ATTEMPT],
        ['/retour|retourne|returned|return |^return|refus|rejet/', Status::RETURNED],
        ['/en livraison|sorti en livraison|out for delivery|livraison en cours|en cours de livraison|en cours de distribution|pret pour livreur/', Status::OUT_FOR_DELIVERY],
        ['/^livre|livree|delivered|encaisse|paye|paid/', Status::DELIVERED],
        ['/pas encore|en attente de ramassage|a ramasser|a verifier|pret a expedier|en preparation|preparation|prepar|nouveau|nouvelle|^new|created|cree|pending|en attente|validee?|confirmee?/', Status::PENDING],
        ['/expedie|transfert|transit|centre|localisation|vers wilaya|recu a|ramasse|prise en charge|arrive|dispatch|en route|shipped|picked|hub|sortie|en cours/', Status::SHIPPED],
    ];

    public static function normalize(string $raw): string
    {
        $t = strtr(mb_strtolower(trim($raw)), ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', '’' => "'"]);
        return trim((string)preg_replace('/\s+/', ' ', str_replace(['_', '-'], ' ', $t)));
    }

    /** $carrier محجوز لقواعد خاصة بشركة عند الحاجة؛ القواعد العامة تغطي ما نعرفه اليوم. */
    public static function map(string $carrier, string $raw): string
    {
        $t = self::normalize($raw);
        if ($t === '') { return Status::UNKNOWN; }
        foreach (self::RULES as [$re, $st]) { if (preg_match($re, $t)) { return $st; } }
        return Status::UNKNOWN;
    }
}
