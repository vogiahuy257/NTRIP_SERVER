<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStationTelemetryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $positionAvailable = fn (): bool => $this->boolean('position.available');

        return [
            /*
             * Trạng thái chung.
             */
            'firmware_version' => [
                'sometimes',
                'nullable',
                'string',
                'max:64',
            ],

            'source_connected' => [
                'sometimes',
                'boolean',
            ],

            /*
             * Danh tính thiết bị đã provision.
             */
            'identity' => [
                'sometimes',
                'array',
            ],

            'identity.hardware_id' => [
                'required_with:identity',
                'string',
                'max:128',
            ],

            'identity.device_id' => [
                'required_with:identity',
                'string',
                'max:128',
            ],

            'identity.provisioned' => [
                'required_with:identity',
                'boolean',
            ],

            'identity.config_revision_applied' => [
                'required_with:identity',
                'integer',
                'min:0',
            ],

            /*
             * Trạng thái mạng.
             */
            'network' => [
                'sometimes',
                'array',
            ],

            'network.type' => [
                'required_with:network',
                'string',
                'max:32',
            ],

            'network.rssi' => [
                'required_with:network',
                'integer',
                'between:-127,0',
            ],

            /*
             * Trạng thái Survey-In từ UBX-NAV-SVIN.
             */
            'survey_in' => [
                'sometimes',
                'array',
            ],

            'survey_in.seen' => [
                'required_with:survey_in',
                'boolean',
            ],

            'survey_in.fresh' => [
                'required_with:survey_in',
                'boolean',
            ],

            'survey_in.state' => [
                'required_with:survey_in',
                'string',
                Rule::in([
                    'unavailable',
                    'surveying',
                    'surveying_valid',
                    'complete',
                    'invalid',
                ]),
            ],

            'survey_in.active' => [
                'required_with:survey_in',
                'boolean',
            ],

            'survey_in.valid' => [
                'required_with:survey_in',
                'boolean',
            ],

            'survey_in.duration_s' => [
                'required_with:survey_in',
                'integer',
                'min:0',
            ],

            'survey_in.observations' => [
                'required_with:survey_in',
                'integer',
                'min:0',
            ],

            'survey_in.mean_accuracy_m' => [
                'required_with:survey_in',
                'numeric',
                'min:0',
            ],

            /*
             * Firmware dùng -1 khi chưa từng nhận
             * UBX-NAV-SVIN.
             */
            'survey_in.age_ms' => [
                'required_with:survey_in',
                'integer',
                'min:-1',
            ],

            /*
             * Tọa độ WGS84 được chuyển từ ECEF
             * của UBX-NAV-SVIN.
             */
            'position' => [
                'sometimes',
                'array',
            ],

            'position.available' => [
                'required_with:position',
                'boolean',
            ],

            'position.fresh' => [
                'required_with:position',
                'boolean',
            ],

            'position.source' => [
                'required_with:position',
                'string',
                Rule::in([
                    'ubx_nav_svin',
                ]),
            ],

            'position.datum' => [
                'required_with:position',
                'string',
                Rule::in([
                    'WGS84',
                ]),
            ],

            'position.altitude_reference' => [
                'required_with:position',
                'string',
                Rule::in([
                    'ellipsoid',
                ]),
            ],

            'position.latitude' => [
                'nullable',
                Rule::requiredIf($positionAvailable),
                'numeric',
                'between:-90,90',
            ],

            'position.longitude' => [
                'nullable',
                Rule::requiredIf($positionAvailable),
                'numeric',
                'between:-180,180',
            ],

            'position.altitude_m' => [
                'nullable',
                Rule::requiredIf($positionAvailable),
                'numeric',
            ],

            'position.accuracy_m' => [
                'nullable',
                Rule::requiredIf($positionAvailable),
                'numeric',
                'min:0',
            ],

            /*
             * Thống kê RTCM.
             */
            'rtcm' => [
                'sometimes',
                'array',
            ],

            'rtcm.bytes_sent' => [
                'required_with:rtcm',
                'integer',
                'min:0',
            ],

            'rtcm.frames_valid' => [
                'required_with:rtcm',
                'integer',
                'min:0',
            ],

            'rtcm.crc_errors' => [
                'required_with:rtcm',
                'integer',
                'min:0',
            ],

            'rtcm.upload_bps' => [
                'required_with:rtcm',
                'integer',
                'min:0',
            ],

            'rtcm.queue_drops' => [
                'required_with:rtcm',
                'integer',
                'min:0',
            ],

            'rtcm.stale_drops' => [
                'required_with:rtcm',
                'integer',
                'min:0',
            ],

            /*
             * Trạng thái hệ thống ESP32.
             */
            'system' => [
                'sometimes',
                'array',
            ],

            'system.uptime_s' => [
                'required_with:system',
                'integer',
                'min:0',
            ],
        ];
    }
}
