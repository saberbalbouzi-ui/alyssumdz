<?php
declare(strict_types=1);
/** تحميل بسيط بلا Composer: يضمّ كل ملفات src بترتيب يراعي الاعتماديات. */
foreach ([
    'Status', 'WilayaCatalog', 'Results', 'Parcel', 'ShippingInterface', 'StatusMapper', 'CommuneMatcher', 'OurGeo', 'CredentialVault',
    'Http/HttpClient', 'Http/CurlHttpClient', 'AbstractAdapter',
    'Adapters/YalidineAdapter', 'Adapters/ZRExpressAdapter', 'Adapters/MaystroAdapter', 'Adapters/NoestAdapter', 'Adapters/EcotrackAdapter',
    'CarrierRegistry', 'ShippingFactory', 'Calibrator', 'ConnectionRepository', 'CalibrationService', 'ShippingService', 'WebhookProcessor',
] as $f) { require_once __DIR__ . '/' . $f . '.php'; }
