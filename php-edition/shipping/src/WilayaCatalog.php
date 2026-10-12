<?php
declare(strict_types=1);
namespace Alyssum\Shipping;

/** كتالوج الولايات الموحَّد DZ-01..DZ-69 (مولَّد من assets/js/wilayas.js). الولايات 59–69 الجديدة تُدار عند الشركات القديمة عبر ولايتها الأم (parent). */
final class WilayaCatalog
{
    /** @var array<int,array{0:string,1:?int}> */
    public const ALL = [
        1 => ["Adrar", null],
        2 => ["Chlef", null],
        3 => ["Laghouat", null],
        4 => ["Oum El Bouaghi", null],
        5 => ["Batna", null],
        6 => ["Béjaïa", null],
        7 => ["Biskra", null],
        8 => ["Béchar", null],
        9 => ["Blida", null],
        10 => ["Bouira", null],
        11 => ["Tamanrasset", null],
        12 => ["Tébessa", null],
        13 => ["Tlemcen", null],
        14 => ["Tiaret", null],
        15 => ["Tizi Ouzou", null],
        16 => ["Alger", null],
        17 => ["Djelfa", null],
        18 => ["Jijel", null],
        19 => ["Sétif", null],
        20 => ["Saïda", null],
        21 => ["Skikda", null],
        22 => ["Sidi Bel Abbès", null],
        23 => ["Annaba", null],
        24 => ["Guelma", null],
        25 => ["Constantine", null],
        26 => ["Médéa", null],
        27 => ["Mostaganem", null],
        28 => ["M'Sila", null],
        29 => ["Mascara", null],
        30 => ["Ouargla", null],
        31 => ["Oran", null],
        32 => ["El Bayadh", null],
        33 => ["Illizi", null],
        34 => ["Bordj Bou Arreridj", null],
        35 => ["Boumerdès", null],
        36 => ["El Tarf", null],
        37 => ["Tindouf", null],
        38 => ["Tissemsilt", null],
        39 => ["El Oued", null],
        40 => ["Khenchela", null],
        41 => ["Souk Ahras", null],
        42 => ["Tipaza", null],
        43 => ["Mila", null],
        44 => ["Aïn Defla", null],
        45 => ["Naâma", null],
        46 => ["Aïn Témouchent", null],
        47 => ["Ghardaïa", null],
        48 => ["Relizane", null],
        49 => ["Timimoun", null],
        50 => ["Bordj Badji Mokhtar", null],
        51 => ["Ouled Djellal", null],
        52 => ["Béni Abbès", null],
        53 => ["In Salah", null],
        54 => ["In Guezzam", null],
        55 => ["Touggourt", null],
        56 => ["Djanet", null],
        57 => ["El M'Ghair", null],
        58 => ["El Menia", null],
        59 => ["Aflou", 3],
        60 => ["Barika", 5],
        61 => ["El Kantara", 7],
        62 => ["Bir El Ater", 12],
        63 => ["El Aricha", 13],
        64 => ["Ksar Chellala", 14],
        65 => ["Aïn Ouessara", 17],
        66 => ["Messaad", 17],
        67 => ["Ksar El Boukhari", 26],
        68 => ["Bou Saâda", 28],
        69 => ["El Abiodh Sidi Cheikh", 32],
    ];

    public static function name(int $code): ?string { return self::ALL[$code][0] ?? null; }

    /** الولاية التي تعتمدها الشركات ذات الترقيم القديم (58): الأم للولايات 59–69، وإلا نفسها. */
    public static function legacyCode(int $code): int { return self::ALL[$code][1] ?? $code; }

    /** @return list<array{code:int,name:string,parent:?int}> */
    public static function list(): array
    {
        $out = [];
        foreach (self::ALL as $code => [$name, $parent]) { $out[] = [code => $code, name => $name, parent => $parent]; }
        return $out;
    }
}
