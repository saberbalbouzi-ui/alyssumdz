<?php
declare(strict_types=1);
namespace Alyssum\Shipping\Http;

final class HttpResponse
{
    public function __construct(public readonly int $status, public readonly string $body, public readonly string $error = '')
    {
    }

    /** @return array<string,mixed>|null */
    public function json(): ?array { $j = json_decode($this->body, true); return is_array($j) ? $j : null; }

    public function ok(): bool { return $this->status >= 200 && $this->status < 300; }
}

interface HttpClient
{
    /** @param array<string,string> $headers */
    public function request(string $method, string $url, array $headers = [], ?string $body = null): HttpResponse;
}
