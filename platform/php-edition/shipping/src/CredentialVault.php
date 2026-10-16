<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/**
 * خزنة مفاتيح API: تشفير AES-256-GCM (مصادَق عليه، يكشف أي تلاعب) بمفتاح من البيئة لا من قاعدة البيانات.
 * الصيغة المخزَّنة (JSON): {"v":1,"kid":"k1","iv":"b64","tag":"b64","ct":"b64"}.
 * التدوير: أضف مفتاحاً جديداً إلى الحلقة واجعله الحالي؛ تبقى القديمة لفكّ ما شُفِّر بها، ثم أعد التشفير بـ reencrypt().
 * المتغيرات: APP_ENCRYPTION_KEY (base64 لـ32 بايت = المفتاح الحالي، المعرّف k1) أو APP_ENCRYPTION_KEYS (JSON {"k1":"b64","k2":"b64"}) + APP_ENCRYPTION_KID.
 * ولّد مفتاحاً: php -r 'echo base64_encode(random_bytes(32)), PHP_EOL;'
 */
final class CredentialVault
{
    private const CIPHER = 'aes-256-gcm';

    /** @param array<string,string> $keys معرّف ← مفتاح خام 32 بايت */
    public function __construct(private array $keys, private string $currentKid)
    {
        if (!in_array(self::CIPHER, openssl_get_cipher_methods(), true)) { throw new CredentialsException('AES-256-GCM غير متاح في هذا الخادم'); }
        if (!isset($keys[$currentKid])) { throw new CredentialsException('مفتاح التشفير الحالي غير موجود'); }
        foreach ($keys as $kid => $k) { if (strlen($k) !== 32) { throw new CredentialsException("المفتاح $kid ليس 32 بايت"); } }
    }

    public static function fromEnv(): self
    {
        $kid = getenv('APP_ENCRYPTION_KID') ?: 'k1';
        $keys = [];
        if (($multi = getenv('APP_ENCRYPTION_KEYS')) !== false && $multi !== '') {
            foreach ((array)json_decode($multi, true) as $id => $b64) { $keys[(string)$id] = (string)base64_decode((string)$b64, true); }
        } elseif (($one = getenv('APP_ENCRYPTION_KEY')) !== false && $one !== '') {
            $keys['k1'] = (string)base64_decode($one, true); $kid = 'k1';
        }
        if (!$keys) { throw new CredentialsException('APP_ENCRYPTION_KEY غير مضبوط (انظر README)'); }
        return new self($keys, $kid);
    }

    /** @param array<string,string>|string $data */
    public function encrypt(array|string $data, string $aad = ''): string
    {
        $plain = is_array($data) ? json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : $data;
        $iv = random_bytes(12); $tag = '';
        $ct = openssl_encrypt($plain, self::CIPHER, $this->keys[$this->currentKid], OPENSSL_RAW_DATA, $iv, $tag, $aad, 16);
        if ($ct === false) { throw new CredentialsException('فشل التشفير'); }
        return json_encode(['v' => 1, 'kid' => $this->currentKid, 'iv' => base64_encode($iv), 'tag' => base64_encode($tag), 'ct' => base64_encode($ct)], JSON_THROW_ON_ERROR);
    }

    /** $aad يربط النص المشفَّر بسياقه (مثلاً user_id|carrier) فلا يمكن نسخه إلى صف آخر. */
    public function decrypt(string $envelope, string $aad = ''): string
    {
        $e = json_decode($envelope, true);
        if (!is_array($e) || ($e['v'] ?? 0) !== 1 || !isset($e['kid'], $e['iv'], $e['tag'], $e['ct'])) { throw new CredentialsException('صيغة مشفَّرة غير صالحة'); }
        $key = $this->keys[(string)$e['kid']] ?? null;
        if ($key === null) { throw new CredentialsException('مفتاح التشفير ' . $e['kid'] . ' غير متوفر'); }
        $plain = openssl_decrypt((string)base64_decode((string)$e['ct'], true), self::CIPHER, $key, OPENSSL_RAW_DATA, (string)base64_decode((string)$e['iv'], true), (string)base64_decode((string)$e['tag'], true), $aad);
        if ($plain === false) { throw new CredentialsException('تعذّر فكّ التشفير (مفتاح خاطئ أو بيانات معدَّلة)'); }
        return $plain;
    }

    /** @return array<string,string> */
    public function decryptArray(string $envelope, string $aad = ''): array
    {
        $a = json_decode($this->decrypt($envelope, $aad), true);
        if (!is_array($a)) { throw new CredentialsException('محتوى المفاتيح غير صالح'); }
        return array_map('strval', $a);
    }

    /** يعيد تشفير ظرف قديم بالمفتاح الحالي (للتدوير). */
    public function reencrypt(string $envelope, string $aad = ''): string { return $this->encrypt($this->decrypt($envelope, $aad), $aad); }

    public function currentKid(): string { return $this->currentKid; }
}
