<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/**
 * يشغّل المعايرة لاتصال محفوظ ويحفظ ملفها في قاعدة البيانات بعد كل دفعة، فتستمر عبر طلبات HTTP قصيرة (حدّ زمن الاستضافة) وتُستأنف إن انقطعت.
 * التاجر لا يُعاد إليه التحكم (في الواجهة) قبل `done`، وكل ما يلتقطه يُستعمل تلقائياً عند الإرسال (ConnectionRepository::adapterFor).
 */
final class CalibrationService
{
    public function __construct(private ConnectionRepository $repo, private OurGeo $geo, private ?Http\HttpClient $http = null, private ?\Closure $pause = null, private int $chunk = 4) {}

    /** يبدأ معايرة جديدة (يحتفظ بما التُقط من webhook سابقاً) ويُنفّذ دفعات حتى انتهاء الميزانية الزمنية. @return array<string,mixed> ملخّص */
    public function start(array $conn, float $budget = 12.0): array
    {
        $ad = $this->adapter($conn);
        $cal = new Calibrator($this->geo, $this->chunk);
        $old = $this->repo->profile((int)$conn['id']);
        $p = $cal->start($ad);
        if (!empty($old['webhook'])) { $p['webhook'] = $old['webhook']; }
        $this->repo->saveProfile((int)$conn['id'], $p);
        return $this->advance($conn, $budget);
    }

    /** يتابع المعايرة الجارية لمدة `$budget` ثانية. @return array<string,mixed> */
    public function advance(array $conn, float $budget = 12.0): array
    {
        $p = $this->repo->profile((int)$conn['id']);
        if (!$p || !isset($p['phase'])) { return $this->start($conn, $budget); }
        $ad = $this->adapter($conn);                      // يحمل الملف الحالي (للتحقق من تحليل التتبع بتصحيحات الحالات)
        $cal = new Calibrator($this->geo, $this->chunk);
        $t0 = microtime(true);
        while (empty($p['done']) && (microtime(true) - $t0) < $budget) {
            $p = $cal->step($ad, $p);
            $this->repo->saveProfile((int)$conn['id'], $p);
        }
        return Calibrator::summary($p);
    }

    /** @return array<string,mixed>|null ملخّص آخر معايرة أو null */
    public function summary(array $conn): ?array
    {
        $p = $this->repo->profile((int)$conn['id']);
        return $p && isset($p['phase']) ? Calibrator::summary($p) : null;
    }

    private function adapter(array $conn): ShippingInterface
    {
        $ad = $this->repo->adapterFor($conn, $this->http);
        $ad->pause = $this->pause ?? static function (int $ms): void { usleep($ms * 1000); };
        return $ad;
    }
}
