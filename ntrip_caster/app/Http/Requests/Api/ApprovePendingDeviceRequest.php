<?php

namespace App\Http\Requests\Api;

use App\Models\PendingDevice;
use Illuminate\Foundation\Http\FormRequest;

class ApprovePendingDeviceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $device = $this->route('pendingDevice');

        if (! $device instanceof PendingDevice) {
            return;
        }

        $deviceId = $this->input('device_id')
            ?: $device->reported_device_id
            ?: 'ESP32-'.$device->id;

        $this->merge([
            'device_id' => $deviceId,

            'name' => $this->input('name')
                ?: 'RTK Base '.$deviceId,

            'mountpoint' => $this->input('mountpoint')
                ?: $device->reported_mountpoint
                ?: 'BASE-'.$deviceId,

            'caster_host' => $this->input('caster_host')
                ?: config('ntrip.public_host'),

            'caster_port' => $this->input('caster_port')
                ?: config('ntrip.port'),

            'uart_baud' => $this->input('uart_baud')
                ?: 115200,

            'telemetry_interval_ms' => $this->input('telemetry_interval_ms')
                ?: 2000,

            'config_poll_interval_ms' => $this->input('config_poll_interval_ms')
                ?: 30000,

            'max_rtcm_age_ms' => $this->input('max_rtcm_age_ms')
                ?: 1500,
        ]);
    }

    public function rules(): array
    {
        return [
            'device_id' => [
                'required',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_-]+$/',
                'unique:stations,device_id',
            ],

            'name' => [
                'required',
                'string',
                'max:120',
            ],

            'mountpoint' => [
                'required',
                'string',
                'max:64',
                'regex:/^[A-Za-z0-9_-]+$/',
                'unique:mountpoints,name',
            ],

            'caster_host' => [
                'required',
                'string',
                'max:255',
            ],

            'caster_port' => [
                'required',
                'integer',
                'between:1,65535',
            ],

            'uart_baud' => [
                'required',
                'integer',
                'between:9600,3000000',
            ],

            'telemetry_interval_ms' => [
                'required',
                'integer',
                'between:500,60000',
            ],

            'config_poll_interval_ms' => [
                'required',
                'integer',
                'between:5000,3600000',
            ],

            'max_rtcm_age_ms' => [
                'required',
                'integer',
                'between:100,60000',
            ],
        ];
    }
}
