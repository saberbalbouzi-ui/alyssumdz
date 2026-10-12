<?php
declare(strict_types=1);
/** يُشغَّل كل دقيقة: php cron.php  (cron: * * * * * php /path/gateway/cron.php) — يزامن طرود الخزنة ويرسل الأحداث المستحقة للعملاء. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/bootstrap.php';
echo json_encode(gw_app()->cron(), JSON_UNESCAPED_UNICODE), PHP_EOL;
