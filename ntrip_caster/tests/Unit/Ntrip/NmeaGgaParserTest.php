<?php

namespace Tests\Unit\Ntrip;

use App\Services\Ntrip\NmeaGgaParser;
use PHPUnit\Framework\TestCase;

final class NmeaGgaParserTest extends TestCase
{
    private NmeaGgaParser $parser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->parser = new NmeaGgaParser;
    }

    public function test_it_parses_valid_gp_gga(): void
    {
        $gga = $this->parser->parse(
            '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47',
        );

        self::assertNotNull($gga);

        self::assertSame(
            '123519',
            $gga['utc_time'],
        );

        self::assertSame(
            48.1173,
            $gga['latitude'],
        );

        self::assertSame(
            11.5166667,
            $gga['longitude'],
        );

        self::assertSame(
            'gps_fix',
            $gga['fix_type'],
        );

        self::assertSame(
            8,
            $gga['satellites'],
        );
    }

    public function test_it_parses_gn_gga_with_south_west(): void
    {
        $gga = $this->parser->parse(
            $this->sentence(
                'GNGGA,101010.50,1058.8074,S,10640.1234,W,4,19,0.7,25.4,M,-1.2,M,,',
            ),
        );

        self::assertNotNull($gga);

        self::assertSame(
            -10.9801233,
            $gga['latitude'],
        );

        self::assertSame(
            -106.6687233,
            $gga['longitude'],
        );

        self::assertSame(
            'rtk_fixed',
            $gga['fix_type'],
        );
    }

    public function test_it_accepts_no_fix_without_position(): void
    {
        $gga = $this->parser->parse(
            $this->sentence(
                'GPGGA,101011.00,,,,,0,00,99.99,,,,,,',
            ),
        );

        self::assertNotNull($gga);

        self::assertNull(
            $gga['latitude'],
        );

        self::assertNull(
            $gga['longitude'],
        );

        self::assertSame(
            'no_fix',
            $gga['fix_type'],
        );
    }

    public function test_it_rejects_invalid_checksum(): void
    {
        self::assertNull(
            $this->parser->parse(
                '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*00',
            ),
        );
    }

    public function test_it_rejects_non_gga_sentence(): void
    {
        self::assertNull(
            $this->parser->parse(
                $this->sentence(
                    'GNRMC,101010.00,A,1058.8074,N,10640.1234,E,0.0,0.0,310726,,,A',
                ),
            ),
        );
    }

    private function sentence(
        string $body,
    ): string {
        $checksum = 0;

        for (
            $index = 0, $length = strlen($body);
            $index < $length;
            $index++
        ) {
            $checksum ^= ord(
                $body[$index],
            );
        }

        return '$'
            .$body
            .'*'
            .sprintf('%02X', $checksum);
    }
}
