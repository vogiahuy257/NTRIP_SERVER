<?php

namespace Tests\Unit\Services\Ntrip\Devices;

use App\Services\Ntrip\Devices\SourceDeviceIdentityParser;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

#[Group('backend')]
#[Group('devices')]
final class SourceDeviceIdentityParserTest extends TestCase
{
    private SourceDeviceIdentityParser $parser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->parser =
            new SourceDeviceIdentityParser;
    }

    public function test_it_detects_a_supported_esp32_request(): void
    {
        $this->assertTrue(
            $this->parser->supports([
                'X-Hardware-ID' => 'ESP32-F024F90E449C',
            ]),
        );

        $this->assertFalse(
            $this->parser->supports([
                'User-Agent' => 'Legacy-NTRIP-Source',
            ]),
        );
    }

    public function test_header_names_are_case_insensitive(): void
    {
        $identity = $this->parser->parse([
            'x-hardware-id' => 'esp32-f024f90e449c',

            'X-DEVICE-ID' => 'CTUAV-BASE-001',

            'x-MountPoint' => 'CTUAV-RTCM-001',

            'X-FIRMWARE-VERSION' => '1.1.0',

            'x-provisioning-state' => 'BOOTSTRAP',
        ]);

        $this->assertSame(
            'ESP32-F024F90E449C',
            $identity->hardwareId,
        );

        $this->assertSame(
            'CTUAV-BASE-001',
            $identity->deviceId,
        );

        $this->assertSame(
            'CTUAV-RTCM-001',
            $identity->mountpoint,
        );

        $this->assertSame(
            '1.1.0',
            $identity->firmwareVersion,
        );

        $this->assertSame(
            'bootstrap',
            $identity->provisioningState,
        );
    }

    public function test_it_uses_the_mountpoint_header_before_request_path(): void
    {
        $identity = $this->parser->parse(
            headers: [
                'X-Hardware-ID' => 'ESP32-F024F90E449C',

                'X-Mountpoint' => 'HEADER-MOUNTPOINT',
            ],
            requestMountpoint: '/REQUEST-MOUNTPOINT',
        );

        $this->assertSame(
            'HEADER-MOUNTPOINT',
            $identity->mountpoint,
        );
    }

    public function test_it_falls_back_to_the_request_mountpoint(): void
    {
        $identity = $this->parser->parse(
            headers: [
                'X-Hardware-ID' => 'ESP32-F024F90E449C',
            ],
            requestMountpoint: '/CTUAV-RTCM-001',
        );

        $this->assertSame(
            'CTUAV-RTCM-001',
            $identity->mountpoint,
        );
    }

    public function test_optional_headers_may_be_missing(): void
    {
        $identity = $this->parser->parse([
            'X-Hardware-ID' => 'ESP32-F024F90E449C',
        ]);

        $this->assertSame(
            'ESP32-F024F90E449C',
            $identity->hardwareId,
        );

        $this->assertNull(
            $identity->deviceId,
        );

        $this->assertNull(
            $identity->mountpoint,
        );

        $this->assertNull(
            $identity->firmwareVersion,
        );

        $this->assertSame(
            'bootstrap',
            $identity->provisioningState,
        );
    }

    public function test_hardware_id_is_required(): void
    {
        $this->expectException(
            InvalidArgumentException::class,
        );

        $this->expectExceptionMessage(
            'X-Hardware-ID is required.',
        );

        $this->parser->parse([
            'X-Device-ID' => 'CTUAV-BASE-001',
        ]);
    }

    public function test_invalid_provisioning_state_is_rejected(): void
    {
        $this->expectException(
            InvalidArgumentException::class,
        );

        $this->expectExceptionMessage(
            'X-Provisioning-State must be bootstrap or provisioned.',
        );

        $this->parser->parse([
            'X-Hardware-ID' => 'ESP32-F024F90E449C',

            'X-Provisioning-State' => 'unknown',
        ]);
    }

    public function test_header_values_cannot_contain_new_lines(): void
    {
        $this->expectException(
            InvalidArgumentException::class,
        );

        $this->expectExceptionMessage(
            'X-Device-ID contains invalid characters.',
        );

        $this->parser->parse([
            'X-Hardware-ID' => 'ESP32-F024F90E449C',

            'X-Device-ID' => "CTUAV-BASE-001\r\nInjected: true",
        ]);
    }

    public function test_mountpoint_leading_slashes_are_removed(): void
    {
        $identity = $this->parser->parse([
            'X-Hardware-ID' => 'ESP32-F024F90E449C',

            'X-Mountpoint' => '///CTUAV-RTCM-001',
        ]);

        $this->assertSame(
            'CTUAV-RTCM-001',
            $identity->mountpoint,
        );
    }

    public function test_present_but_empty_hardware_id_is_invalid(): void
    {
        $headers = [
            'X-Hardware-ID' => '   ',
        ];

        $this->assertTrue(
            $this->parser->supports(
                $headers,
            ),
        );

        $this->expectException(
            InvalidArgumentException::class,
        );

        $this->expectExceptionMessage(
            'X-Hardware-ID is required.',
        );

        $this->parser->parse(
            $headers,
        );
    }
}
