<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

final class ShipmentResult
{
    /** @param array<string,mixed> $raw */
    public function __construct(public readonly bool $ok, public readonly string $tracking = '', public readonly ?string $labelUrl = null, public readonly string $error = '', public readonly array $raw = []) {}
}

final class TrackingResult
{
    /** @param array<string,mixed> $raw */
    public function __construct(public readonly string $tracking, public readonly string $rawStatus, public readonly string $status, public readonly array $raw = []) {}
}

final class WebhookEvent
{
    /** @param array<string,mixed> $raw */
    public function __construct(public readonly string $tracking, public readonly string $rawStatus, public readonly string $status, public readonly string $orderRef = '', public readonly array $raw = []) {}
}

class ShippingException extends \RuntimeException {}
final class UnsupportedCarrierException extends ShippingException {}
final class CarrierApiException extends ShippingException {}
final class CredentialsException extends ShippingException {}
