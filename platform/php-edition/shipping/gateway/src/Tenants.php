<?php
declare(strict_types=1);
namespace Alyssum\Gateway;

use Alyssum\Shipping\CredentialVault;

/** المستأجرون (عملاء الخدمة) ومفاتيح API والخطط. المفتاح الصريح يُعرض مرة واحدة؛ يُخزَّن sha256 فقط. */
final class Tenants
{
    public function __construct(private \PDO $db, private CredentialVault $vault) {}

    public function createTenant(string $name, string $email, string $plan = 'free'): int
    {
        if (!$this->plan($plan)) { throw new \InvalidArgumentException("خطة غير معروفة: $plan"); }
        $this->db->prepare('INSERT INTO gw_tenants (name,email,plan,status,created_at) VALUES (?,?,?,?,?)')->execute([mb_substr($name, 0, 120), mb_substr($email, 0, 160), $plan, 'active', gmdate('Y-m-d H:i:s')]);
        return (int)$this->db->lastInsertId();
    }

    /** @return string المفتاح الصريح gk_live_… أو gk_test_… (يظهر هذه المرة فقط) */
    public function issueKey(int $tenantId, string $mode = 'live', string $label = ''): string
    {
        if (!in_array($mode, ['live', 'test'], true)) { throw new \InvalidArgumentException('mode: live|test'); }
        $key = 'gk_' . $mode . '_' . bin2hex(random_bytes(20));
        $this->db->prepare('INSERT INTO gw_keys (tenant_id,prefix,key_hash,mode,label,created_at) VALUES (?,?,?,?,?,?)')->execute([$tenantId, substr($key, 0, 12), hash('sha256', $key), $mode, mb_substr($label, 0, 60), gmdate('Y-m-d H:i:s')]);
        return $key;
    }

    public function revokeKey(int $keyId): void { $this->db->prepare('UPDATE gw_keys SET revoked_at=? WHERE id=? AND revoked_at IS NULL')->execute([gmdate('Y-m-d H:i:s'), $keyId]); }
    public function setStatus(int $tenantId, string $status): void { $this->db->prepare('UPDATE gw_tenants SET status=? WHERE id=?')->execute([$status, $tenantId]); }
    public function setPlan(int $tenantId, string $plan): void { if (!$this->plan($plan)) { throw new \InvalidArgumentException("خطة غير معروفة: $plan"); } $this->db->prepare('UPDATE gw_tenants SET plan=? WHERE id=?')->execute([$plan, $tenantId]); }

    /** @return array{tenant:array<string,mixed>,key:array<string,mixed>,plan:array<string,mixed>}|null */
    public function authenticate(string $bearer): ?array
    {
        if (!preg_match('/^gk_(live|test)_[0-9a-f]{40}$/', $bearer)) { return null; }
        $st = $this->db->prepare('SELECT * FROM gw_keys WHERE key_hash=? AND revoked_at IS NULL'); $st->execute([hash('sha256', $bearer)]);
        $k = $st->fetch(); if (!$k) { return null; }
        $st = $this->db->prepare('SELECT * FROM gw_tenants WHERE id=?'); $st->execute([$k['tenant_id']]); $t = $st->fetch();
        if (!$t || $t['status'] !== 'active') { return null; }
        $this->db->prepare('UPDATE gw_keys SET last_used_at=? WHERE id=?')->execute([gmdate('Y-m-d H:i:s'), $k['id']]);
        return ['tenant' => $t, 'key' => $k, 'plan' => $this->plan((string)$t['plan'])];
    }

    /** @return array<string,mixed>|null */
    public function plan(string $id): ?array { $st = $this->db->prepare('SELECT * FROM gw_plans WHERE id=?'); $st->execute([$id]); return $st->fetch() ?: null; }

    /** يضبط رابط webhook الصادر ويولّد سرّاً جديداً (يُعرض مرة واحدة). */
    public function setWebhook(int $tenantId, string $url): string
    {
        $secret = 'whsec_' . bin2hex(random_bytes(24));
        $this->db->prepare('UPDATE gw_tenants SET webhook_url=?, webhook_secret_enc=? WHERE id=?')->execute([$url, $this->vault->encrypt($secret, "gw-webhook:$tenantId"), $tenantId]);
        return $secret;
    }
    public function clearWebhook(int $tenantId): void { $this->db->prepare('UPDATE gw_tenants SET webhook_url=NULL, webhook_secret_enc=NULL WHERE id=?')->execute([$tenantId]); }

    /** @return array{url:string,secret:string}|null */
    public function webhook(int $tenantId): ?array
    {
        $st = $this->db->prepare('SELECT webhook_url, webhook_secret_enc FROM gw_tenants WHERE id=?'); $st->execute([$tenantId]); $r = $st->fetch();
        if (!$r || !$r['webhook_url'] || !$r['webhook_secret_enc']) { return null; }
        return ['url' => (string)$r['webhook_url'], 'secret' => $this->vault->decrypt((string)$r['webhook_secret_enc'], "gw-webhook:$tenantId")];
    }
}
