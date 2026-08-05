<?php

declare(strict_types=1);

namespace App\Services\Ntrip\Sessions;

use App\Models\Mountpoint;
use App\Models\NtripSession;
use App\Models\RoverAccount;
use App\Models\Station;
use Carbon\CarbonInterface;

final class NtripSessionPayloadFactory
{
    /**
     * @return array<string, mixed>
     */
    public function make(NtripSession $session): array
    {
        $session->loadMissing([
            'roverAccount:id,username,display_name',
            'mountpoint:id,station_id,name',
            'mountpoint.station:id,device_id,name',
        ]);

        $mountpointRelation = $session->getRelation('mountpoint');
        $mountpoint = $mountpointRelation instanceof Mountpoint
            ? $mountpointRelation
            : null;

        $stationRelation = $mountpoint?->getRelation('station');
        $station = $stationRelation instanceof Station
            ? $stationRelation
            : null;

        $accountRelation = $session->getRelation('roverAccount');
        $roverAccount = $accountRelation instanceof RoverAccount
            ? $accountRelation
            : null;

        return [
            'id' => $session->id,
            'mountpoint_id' => $session->mountpoint_id,
            'requested_mountpoint' => $session->requested_mountpoint,
            'auto_mountpoint' => (bool) $session->auto_mountpoint,
            'auto_state' => $this->autoState($session),
            'mountpoint_switch_count' => (int) $session->mountpoint_switch_count,
            'last_mountpoint_switch_at' => $this->iso8601(
                $session->last_mountpoint_switch_at,
            ),

            'station_id' => $session->station_id,
            'rover_account_id' => $session->rover_account_id,
            'connection_type' => $session->connection_type,
            'authenticated_username' => $session->authenticated_username,
            'client_agent' => $session->client_agent,
            'ntrip_version' => $session->ntrip_version,
            'remote_ip' => $session->remote_ip,
            'connected_at' => $this->iso8601($session->connected_at),
            'disconnected_at' => $this->iso8601($session->disconnected_at),
            'bytes_transferred' => (int) $session->bytes_transferred,
            'disconnect_reason' => $session->disconnect_reason,
            'valid_rtcm_frames' => (int) $session->valid_rtcm_frames,
            'rtcm_crc_errors' => (int) $session->rtcm_crc_errors,
            'rtcm_message_counts' => $session->rtcm_message_counts ?? [],

            'rover_latitude' => $session->rover_latitude,
            'rover_longitude' => $session->rover_longitude,
            'rover_altitude_m' => $session->rover_altitude_m,
            'rover_geoid_separation_m' => $session->rover_geoid_separation_m,
            'rover_fix_quality' => $session->rover_fix_quality,
            'rover_fix_type' => $session->rover_fix_type,
            'rover_satellites' => $session->rover_satellites,
            'rover_hdop' => $session->rover_hdop,
            'rover_gga_utc' => $session->rover_gga_utc,
            'rover_gga_received_at' => $this->iso8601(
                $session->rover_gga_received_at,
            ),
            'rover_position_received_at' => $this->iso8601(
                $session->rover_position_received_at,
            ),

            'rover_account' => $roverAccount === null
                ? null
                : [
                    'id' => $roverAccount->id,
                    'username' => $roverAccount->username,
                    'display_name' => $roverAccount->display_name,
                ],

            'mountpoint' => $mountpoint === null
                ? null
                : [
                    'id' => $mountpoint->id,
                    'station_id' => $mountpoint->station_id,
                    'name' => $mountpoint->name,
                    'station' => $station === null
                        ? null
                        : [
                            'id' => $station->id,
                            'device_id' => $station->device_id,
                            'name' => $station->name,
                        ],
                ],
        ];
    }

    private function autoState(NtripSession $session): ?string
    {
        if (! $session->auto_mountpoint) {
            return null;
        }

        if ($session->mountpoint_id !== null) {
            return 'assigned';
        }

        return $session->rover_position_received_at === null
            ? 'waiting_for_gga'
            : 'waiting_for_base';
    }

    private function iso8601(mixed $value): ?string
    {
        return $value instanceof CarbonInterface
            ? $value->toIso8601String()
            : null;
    }
}
