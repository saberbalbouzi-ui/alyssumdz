<?php
declare(strict_types=1);
/** إدارة البوابة من الطرفية (لصاحب الخدمة): php admin.php <أمر> […] */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/bootstrap.php';
$app = gw_app(); $t = $app->tenants; $db = gw_pdo(); $a = array_slice($argv, 1); $cmd = $a[0] ?? 'help';
switch ($cmd) {
    case 'tenant:create': $id = $t->createTenant((string)($a[1] ?? ''), (string)($a[2] ?? ''), (string)($a[3] ?? 'free')); echo "tenant id=$id\n"; break;
    case 'key:create':    echo $t->issueKey((int)($a[1] ?? 0), (string)($a[2] ?? 'live'), (string)($a[3] ?? '')), "\n(يُعرض مرة واحدة)\n"; break;
    case 'key:revoke':    $t->revokeKey((int)($a[1] ?? 0)); echo "ok\n"; break;
    case 'tenant:plan':   $t->setPlan((int)($a[1] ?? 0), (string)($a[2] ?? '')); echo "ok\n"; break;
    case 'tenant:suspend': $t->setStatus((int)($a[1] ?? 0), 'suspended'); echo "ok\n"; break;
    case 'tenant:activate': $t->setStatus((int)($a[1] ?? 0), 'active'); echo "ok\n"; break;
    case 'plan:price':    $db->prepare('UPDATE gw_plans SET price_dzd=? WHERE id=?')->execute([(int)($a[2] ?? 0), (string)($a[1] ?? '')]); echo "ok\n"; break;
    case 'tenants':       foreach ($db->query('SELECT t.id,t.name,t.email,t.plan,t.status,(SELECT COUNT(*) FROM gw_orders o WHERE o.tenant_id=t.id) AS orders FROM gw_tenants t')->fetchAll() as $r) { echo implode("\t", $r), "\n"; } break;
    case 'usage':         foreach ($db->query('SELECT tenant_id,day,kind,n FROM gw_usage ORDER BY day DESC LIMIT 60')->fetchAll() as $r) { echo implode("\t", $r), "\n"; } break;
    default: echo "الأوامر: tenant:create <اسم> <بريد> [خطة] | key:create <tenant> [live|test] [وسم] | key:revoke <id> | tenant:plan <id> <خطة> | tenant:suspend|tenant:activate <id> | plan:price <خطة> <دج> | tenants | usage\n";
}
