<?php

declare(strict_types=1);

namespace App\Services\Ntrip\AutoMountpoint;

use App\Enums\Ntrip\AutoMountpointAction;

final class AutoMountpointSwitchPolicy
{
    public function evaluate(
        AutoMountpointDecision $decision,
        ?int $currentMountpointId,
        ?int $outsideSince,
        ?int $lastSwitchAt,
        int $now,
        int $confirmationSeconds,
        int $cooldownSeconds,
    ): AutoMountpointTransition {
        if (
            $decision->action
            === AutoMountpointAction::KEEP
        ) {
            return new AutoMountpointTransition(
                apply: false,
                outsideSince: null,
            );
        }

        if (
            $decision->action
            === AutoMountpointAction::ASSIGN
        ) {
            return new AutoMountpointTransition(
                apply: true,
                outsideSince: null,
            );
        }

        /*
         * Base hiện tại không còn source hoặc bị disable.
         * Không tiếp tục sử dụng RTCM từ Base lỗi.
         */
        if (
            $decision->reason
            === 'current_base_unavailable'
        ) {
            return new AutoMountpointTransition(
                apply: true,
                outsideSince: null,
            );
        }

        /*
         * Rover chưa từng được gán Base và hiện tại
         * cũng chưa có candidate phù hợp.
         */
        if ($currentMountpointId === null) {
            return new AutoMountpointTransition(
                apply: false,
                outsideSince: null,
            );
        }

        $confirmationSeconds = max(
            0,
            $confirmationSeconds,
        );

        $cooldownSeconds = max(
            0,
            $cooldownSeconds,
        );

        if ($outsideSince === null) {
            return new AutoMountpointTransition(
                apply: $confirmationSeconds === 0,
                outsideSince: $confirmationSeconds === 0
                    ? null
                    : $now,
            );
        }

        if (
            $now - $outsideSince
            < $confirmationSeconds
        ) {
            return new AutoMountpointTransition(
                apply: false,
                outsideSince: $outsideSince,
            );
        }

        if (
            $lastSwitchAt !== null
            && $now - $lastSwitchAt
                < $cooldownSeconds
        ) {
            return new AutoMountpointTransition(
                apply: false,
                outsideSince: $outsideSince,
            );
        }

        return new AutoMountpointTransition(
            apply: true,
            outsideSince: null,
        );
    }
}
