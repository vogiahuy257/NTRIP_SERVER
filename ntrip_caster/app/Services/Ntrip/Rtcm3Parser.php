<?php

namespace App\Services\Ntrip;

class Rtcm3Parser
{
    private string $buffer = '';

    private int $validFrames = 0;

    private int $crcErrors = 0;

    /**
     * @var array<int, int>
     */
    private array $messageCounts = [];

    public function push(string $data): void
    {
        $this->buffer .= $data;

        while (true) {
            $preamblePosition = strpos(
                $this->buffer,
                "\xD3"
            );

            if ($preamblePosition === false) {
                $this->buffer = '';

                return;
            }

            if ($preamblePosition > 0) {
                $this->buffer = substr(
                    $this->buffer,
                    $preamblePosition
                );
            }

            if (strlen($this->buffer) < 3) {
                return;
            }

            $payloadLength = (
                (ord($this->buffer[1]) & 0x03) << 8
            ) | ord($this->buffer[2]);

            $frameLength = 3 + $payloadLength + 3;

            if (strlen($this->buffer) < $frameLength) {
                return;
            }

            $frame = substr(
                $this->buffer,
                0,
                $frameLength
            );

            $this->buffer = substr(
                $this->buffer,
                $frameLength
            );

            $frameWithoutCrc = substr(
                $frame,
                0,
                $frameLength - 3
            );

            $expectedCrc = (
                ord($frame[$frameLength - 3]) << 16
            ) | (
                ord($frame[$frameLength - 2]) << 8
            ) | ord($frame[$frameLength - 1]);

            $calculatedCrc = $this->crc24q(
                $frameWithoutCrc
            );

            if ($expectedCrc !== $calculatedCrc) {
                $this->crcErrors++;

                continue;
            }

            $this->validFrames++;

            $messageType = $this->extractMessageType(
                $frame
            );

            if ($messageType !== null) {
                $this->messageCounts[$messageType] =
                    ($this->messageCounts[$messageType] ?? 0) + 1;
            }
        }
    }

    public function validFrames(): int
    {
        return $this->validFrames;
    }

    public function crcErrors(): int
    {
        return $this->crcErrors;
    }

    /**
     * @return array<int, int>
     */
    public function messageCounts(): array
    {
        ksort($this->messageCounts);

        return $this->messageCounts;
    }

    private function extractMessageType(
        string $frame
    ): ?int {
        if (strlen($frame) < 5) {
            return null;
        }

        $firstPayloadByte = ord($frame[3]);
        $secondPayloadByte = ord($frame[4]);

        return (
            $firstPayloadByte << 4
        ) | (
            $secondPayloadByte >> 4
        );
    }

    private function crc24q(
        string $data
    ): int {
        $crc = 0;

        $length = strlen($data);

        for ($index = 0; $index < $length; $index++) {
            $crc ^= ord($data[$index]) << 16;

            for ($bit = 0; $bit < 8; $bit++) {
                $crc <<= 1;

                if (($crc & 0x1000000) !== 0) {
                    $crc ^= 0x1864CFB;
                }
            }
        }

        return $crc & 0xFFFFFF;
    }
}
