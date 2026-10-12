<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

use Alyssum\Shipping\Http\HttpClient;

/** منطق التاجر: «أرسل هذا الطلب عبر الشركة X». عدم التكرار مضمون في قاعدة البيانات (UNIQUE connection+order). */
final class ShippingService
{
    /** نداء اختياري بعد كل تغيير حالة فعلي: fn(string $orderRef, string $carrier, string $tracking, string $status): void — تستعمله النسخة المدمجة لتحديث حالة الطلب. */
    public ?\Closure $onStatus = null;

    public function __construct(private \PDO $db, private ConnectionRepository $repo, private ?HttpClient $http = null) {}

    public function ship(int $userId, string $carrier, Parcel $parcel): ShipmentResult
    {
        $conn = $this->repo->find($userId, $carrier) ?? throw new CredentialsException('الشركة غير مفعّلة لهذا التاجر');
        $adapter = $this->repo->adapterFor($conn, $this->http);
        $now = gmdate('Y-m-d H:i:s');
        // حجز الإرسال أولاً: التزامن أو إعادة الضغط يصطدم بالقيد الفريد بدل إنشاء طرد ثانٍ عند الشركة
        try {
            $this->db->prepare('INSERT INTO shipments (connection_id,user_id,order_ref,carrier_code,tracking,status,cod_amount,created_at) VALUES (?,?,?,?,NULL,?,?,?)')
                ->execute([$conn['id'], $userId, $parcel->orderRef, $conn['carrier_code'], Status::PENDING, (int)round($parcel->total), $now]);
        } catch (\PDOException) {
            $st = $this->db->prepare('SELECT tracking FROM shipments WHERE connection_id=? AND order_ref=?'); $st->execute([$conn['id'], $parcel->orderRef]);
            $trk = (string)$st->fetchColumn();
            return $trk !== '' ? new ShipmentResult(true, $trk, null, 'duplicate') : new ShipmentResult(false, error: 'الإرسال جارٍ لهذا الطلب، حاول بعد قليل');
        }
        $id = (int)$this->db->lastInsertId();
        try { $res = $adapter->createParcel($parcel); }
        catch (\Throwable $e) { $this->db->prepare('DELETE FROM shipments WHERE id=?')->execute([$id]); throw $e; }
        if (!$res->ok) { $this->db->prepare('DELETE FROM shipments WHERE id=?')->execute([$id]); return $res; }   // يُحرَّر الحجز ليمكن إعادة المحاولة بعد التصحيح
        $this->db->prepare('UPDATE shipments SET tracking=? WHERE id=?')->execute([$res->tracking, $id]);
        return $res;
    }

    public function track(int $userId, string $carrier, string $tracking): TrackingResult
    {
        $conn = $this->repo->find($userId, $carrier) ?? throw new CredentialsException('الشركة غير مفعّلة لهذا التاجر');
        $r = $this->repo->adapterFor($conn, $this->http)->trackParcel($tracking);
        $this->applyStatus((int)$conn['id'], $tracking, $r->rawStatus, $r->status);
        return $r;
    }

    public function cancel(int $userId, string $carrier, string $tracking): bool
    {
        $conn = $this->repo->find($userId, $carrier) ?? throw new CredentialsException('الشركة غير مفعّلة لهذا التاجر');
        $ok = $this->repo->adapterFor($conn, $this->http)->cancelParcel($tracking);
        if ($ok) { $this->applyStatus((int)$conn['id'], $tracking, 'cancelled', Status::CANCELLED); }
        return $ok;
    }

    /** يطبّق حالة على طرد إن كان الانتقال مسموحاً. @return bool هل تغيّرت الحالة */
    public function applyStatus(int $connectionId, string $tracking, string $raw, string $status, string $orderRef = ''): bool
    {
        $st = $this->db->prepare('SELECT id,status,order_ref,carrier_code FROM shipments WHERE connection_id=? AND tracking=?'); $st->execute([$connectionId, $tracking]);
        $row = $st->fetch(\PDO::FETCH_ASSOC);
        if (!$row && $orderRef !== '') { $st = $this->db->prepare('SELECT id,status,order_ref,carrier_code FROM shipments WHERE connection_id=? AND order_ref=?'); $st->execute([$connectionId, $orderRef]); $row = $st->fetch(\PDO::FETCH_ASSOC); }
        if (!$row) { return false; }
        $hash = sha1($connectionId . '|' . $tracking . '|' . $raw . '|' . $status);
        $now = gmdate('Y-m-d H:i:s');
        try { $this->db->prepare('INSERT INTO shipment_events (shipment_id,raw_status,status,event_hash,created_at) VALUES (?,?,?,?,?)')->execute([$row['id'], mb_substr($raw, 0, 190), $status, $hash, $now]); }
        catch (\PDOException) { return false; }                                  // حدث مكرَّر (إعادة إرسال)
        if (!Status::canTransition((string)$row['status'], $status)) { return false; }
        $this->db->prepare('UPDATE shipments SET status=?, raw_status=?, last_event_at=? WHERE id=?')->execute([$status, mb_substr($raw, 0, 190), $now, $row['id']]);
        if ($this->onStatus) { try { ($this->onStatus)((string)$row['order_ref'], (string)$row['carrier_code'], $tracking, $status); } catch (\Throwable $e) { error_log('shipping onStatus: ' . $e->getMessage()); } }
        return true;
    }
}
