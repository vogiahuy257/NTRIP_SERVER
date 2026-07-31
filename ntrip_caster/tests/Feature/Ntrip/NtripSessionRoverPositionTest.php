<?php

namespace Tests\Feature\Ntrip;

use App\Events\NtripSessionUpdated;
use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Services\Ntrip\Sessions\NtripSessionService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

final class NtripSessionRoverPositionTest extends TestCase
{
    use DatabaseMigrations;

    public function test_it_updates_only_the_target_rover(): void
    {
        Event::fake([
            NtripSessionUpdated::class,
        ]);

        $mountpoint =
            Mountpoint::factory()->create();

        $target = NtripSession::factory()
            ->for($mountpoint)
            ->create();

        $other = NtripSession::factory()
            ->for($mountpoint)
            ->create();

        $updated = app(NtripSessionService::class)
            ->updateRoverPosition(
                sessionId: $target->id,
                position: $this->fixedPosition(),
            );

        self::assertTrue($updated);

        $target->refresh();
        $other->refresh();

        self::assertEqualsWithDelta(
            10.9801233,
            $target->rover_latitude,
            0.0000001,
        );

        self::assertEqualsWithDelta(
            106.6687233,
            $target->rover_longitude,
            0.0000001,
        );

        self::assertSame(
            'rtk_fixed',
            $target->rover_fix_type,
        );

        self::assertNull(
            $other->rover_latitude,
        );

        self::assertNull(
            $other->rover_longitude,
        );

        Event::assertDispatched(
            NtripSessionUpdated::class,

            fn (
                NtripSessionUpdated $event,
            ): bool => $event->session['id']
                    === $target->id
                && $event->session['rover_fix_type']
                    === 'rtk_fixed',
        );
    }

    public function test_no_fix_keeps_last_position(): void
    {
        Event::fake([
            NtripSessionUpdated::class,
        ]);

        $session =
            NtripSession::factory()->create([
                'rover_latitude' => 10.1,
                'rover_longitude' => 106.2,

                'rover_position_received_at' => now()->subMinute(),
            ]);

        $updated = app(NtripSessionService::class)
            ->updateRoverPosition(
                sessionId: $session->id,

                position: [
                    'utc_time' => '101011.00',
                    'latitude' => null,
                    'longitude' => null,
                    'altitude_m' => null,
                    'geoid_separation_m' => null,
                    'fix_quality' => 0,
                    'fix_type' => 'no_fix',
                    'satellites' => 0,
                    'hdop' => 99.99,
                ],
            );

        self::assertTrue($updated);

        $session->refresh();

        self::assertEqualsWithDelta(
            10.1,
            $session->rover_latitude,
            0.0000001,
        );

        self::assertEqualsWithDelta(
            106.2,
            $session->rover_longitude,
            0.0000001,
        );

        self::assertSame(
            'no_fix',
            $session->rover_fix_type,
        );

        self::assertSame(
            0,
            $session->rover_fix_quality,
        );
    }

    public function test_it_rejects_non_active_rovers(): void
    {
        Event::fake([
            NtripSessionUpdated::class,
        ]);

        $source =
            NtripSession::factory()->create([
                'connection_type' => NtripSession::TYPE_SOURCE,
            ]);

        $disconnectedRover =
            NtripSession::factory()
                ->disconnected()
                ->create();

        $service =
            app(NtripSessionService::class);

        self::assertFalse(
            $service->updateRoverPosition(
                $source->id,
                $this->fixedPosition(),
            ),
        );

        self::assertFalse(
            $service->updateRoverPosition(
                $disconnectedRover->id,
                $this->fixedPosition(),
            ),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function fixedPosition(): array
    {
        return [
            'utc_time' => '101010.50',
            'latitude' => 10.9801233,
            'longitude' => 106.6687233,
            'altitude_m' => 25.4,
            'geoid_separation_m' => -1.2,
            'fix_quality' => 4,
            'fix_type' => 'rtk_fixed',
            'satellites' => 19,
            'hdop' => 0.7,
        ];
    }
}
