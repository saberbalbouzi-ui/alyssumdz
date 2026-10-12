<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Http;

/** عميل HTTP آمن: HTTPS فقط، يرفض العناوين الداخلية (SSRF) ويثبّت الـIP الذي تحقّق منه (يمنع تبديل DNS)، مهلة وحدّ حجم. */
final class CurlHttpClient implements HttpClient
{
    public function __construct(private int $timeout = 25, private int $maxBytes = 2_000_000, private bool $allowLocalHttp = false) {}

    public function request(string $method, string $url, array $headers = [], ?string $body = null): HttpResponse
    {
        $p = parse_url($url);
        $host = (string)($p['host'] ?? ''); $scheme = (string)($p['scheme'] ?? '');
        $local = $this->allowLocalHttp && $scheme === 'http' && in_array($host, ['127.0.0.1', 'localhost'], true);
        if ($host === '' || ($scheme !== 'https' && !$local)) { return new HttpResponse(0, '', 'insecure_url'); }
        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
        if (!filter_var($ip, FILTER_VALIDATE_IP)) { return new HttpResponse(0, '', 'dns_failed'); }
        if (!$local && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) { return new HttpResponse(0, '', 'private_address'); }
        $port = (int)($p['port'] ?? ($scheme === 'https' ? 443 : 80));
        $h = [];
        foreach ($headers as $k => $v) { if (preg_match('/^[A-Za-z0-9-]{1,60}$/', (string)$k) && !preg_match("/[\r\n]/", (string)$v)) { $h[] = "$k: $v"; } }
        $buf = '';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => strtoupper($method), CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => $this->timeout, CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_RESOLVE => ["$host:$port:$ip"],
            CURLOPT_PROTOCOLS => $local ? CURLPROTO_HTTP | CURLPROTO_HTTPS : CURLPROTO_HTTPS,
            CURLOPT_WRITEFUNCTION => function ($c, $d) use (&$buf) { $buf .= $d; return strlen($buf) > $this->maxBytes ? 0 : strlen($d); },
        ]);
        if ($body !== null) { curl_setopt($ch, CURLOPT_POSTFIELDS, $body); }
        curl_exec($ch);
        $err = curl_error($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return new HttpResponse($code, $buf, $err);
    }
}
