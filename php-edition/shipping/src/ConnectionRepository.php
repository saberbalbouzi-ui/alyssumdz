<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** تخزين اتصالات التاجر بالشركات: المفاتيح مشفَّرة، ورابط الـwebhook بسرّ عشوائي لا يُحفظ إلا مجزَّأً. */
final class ConnectionRepository
{
    public function __construct(private \PDO $db, private CredentialVault $vault) {}

    private static function aad(int $userId, string $carrier): string { return "user:$userId|carrier:$carrier"; }

    /**
     * يفعّل شركة لتاجر (أو يحدّث مفاتيحها). يتحقق من الحقول المطلوبة بلا اتصال بالشبكة.
     * @param array<string,string> $credentials
     * @return array{id:int,public_id:string,webhook_secret:string} السرّ يُعرض للتاجر مرة واحدة فقط.
     */
    public function connect(int $userId, string $carrier, array $credentials, ?string $baseUrl = null, bool $verify = false, ?Http\HttpClient $http = null): array
    {
        $code = CarrierRegistry::resolve($carrier) ?? throw new UnsupportedCarrierException("شركة غير معروفة: $carrier");
        $adapter = ShippingFactory::make($code, $http, $baseUrl);       // يرمي إن كانت planned
        $adapter->authenticate($credentials);                           // يتحقق من الحقول المطلوبة
        $ping = ['ok' => null, 'message' => ''];
        if ($verify) {                                                  // لا نحفظ مفاتيح ترفضها الشركة: يُكتشف الخطأ الآن لا عند أول طلب حقيقي
            $ping = $adapter->ping();
            if ($ping['ok'] === false) { throw new CredentialsException('رفضت الشركة هذه المفاتيح: ' . $ping['message']); }
        }
        $enc = $this->vault->encrypt($credentials, self::aad($userId, $code));
        $secret = bin2hex(random_bytes(24)); $hash = hash('sha256', $secret); $now = gmdate('Y-m-d H:i:s');
        $row = $this->find($userId, $code);
        if ($row) {
            $st = $this->db->prepare('UPDATE user_carriers SET credentials_enc=?, key_id=?, base_url=?, webhook_token_hash=?, is_active=1, updated_at=? WHERE id=?');
            $st->execute([$enc, $this->vault->currentKid(), $baseUrl, $hash, $now, $row['id']]);
            return ['id' => (int)$row['id'], 'public_id' => (string)$row['public_id'], 'webhook_secret' => $secret, 'ping' => $ping];
        }
        $pub = bin2hex(random_bytes(12));
        $st = $this->db->prepare('INSERT INTO user_carriers (public_id,user_id,carrier_code,credentials_enc,key_id,base_url,webhook_token_hash,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)');
        $st->execute([$pub, $userId, $code, $enc, $this->vault->currentKid(), $baseUrl, $hash, $now, $now]);
        return ['id' => (int)$this->db->lastInsertId(), 'public_id' => $pub, 'webhook_secret' => $secret, 'ping' => $ping];
    }

    /** @return array<string,mixed>|null */
    public function find(int $userId, string $carrier): ?array
    {
        $st = $this->db->prepare('SELECT * FROM user_carriers WHERE user_id=? AND carrier_code=?'); $st->execute([$userId, CarrierRegistry::resolve($carrier) ?? $carrier]);
        return $st->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    /** @return array<string,mixed>|null */
    public function findByPublicId(string $publicId): ?array
    {
        if (!preg_match('/^[a-f0-9]{24}$/', $publicId)) { return null; }
        $st = $this->db->prepare('SELECT * FROM user_carriers WHERE public_id=? AND is_active=1'); $st->execute([$publicId]);
        return $st->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    public function disconnect(int $userId, string $carrier): void
    {
        $st = $this->db->prepare('UPDATE user_carriers SET is_active=0, updated_at=? WHERE user_id=? AND carrier_code=?'); $st->execute([gmdate('Y-m-d H:i:s'), $userId, CarrierRegistry::resolve($carrier) ?? $carrier]);
    }

    public function checkWebhookToken(array $row, string $token): bool { return $token !== '' && hash_equals((string)$row['webhook_token_hash'], hash('sha256', $token)); }

    /** يفكّ تشفير مفاتيح اتصال ويبني المحوّل جاهزاً. @param array<string,mixed> $row */
    public function adapterFor(array $row, ?Http\HttpClient $http = null): ShippingInterface
    {
        if (!(int)$row['is_active']) { throw new CredentialsException('الشركة غير مفعّلة'); }
        $cred = $this->vault->decryptArray((string)$row['credentials_enc'], self::aad((int)$row['user_id'], (string)$row['carrier_code']));
        return ShippingFactory::make((string)$row['carrier_code'], $http, $row['base_url'] !== null ? (string)$row['base_url'] : null)->authenticate($cred);
    }

    /** يعيد تشفير كل المفاتيح بالمفتاح الحالي (بعد تدوير الحلقة). @return int عدد الصفوف */
    public function rotate(): int
    {
        $n = 0;
        foreach ($this->db->query('SELECT id,user_id,carrier_code,credentials_enc,key_id FROM user_carriers')->fetchAll(\PDO::FETCH_ASSOC) as $r) {
            if ($r['key_id'] === $this->vault->currentKid()) { continue; }
            $enc = $this->vault->reencrypt((string)$r['credentials_enc'], self::aad((int)$r['user_id'], (string)$r['carrier_code']));
            $this->db->prepare('UPDATE user_carriers SET credentials_enc=?, key_id=? WHERE id=?')->execute([$enc, $this->vault->currentKid(), $r['id']]); $n++;
        }
        return $n;
    }
}
