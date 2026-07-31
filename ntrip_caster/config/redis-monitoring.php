<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Redis Monitoring
    |--------------------------------------------------------------------------
    */

    'enabled' => env(
        'REDIS_MONITORING_ENABLED',
        true,
    ),

    'latency_warning_ms' => (float) env(
        'REDIS_LATENCY_WARNING_MS',
        25,
    ),

    'latency_critical_ms' => (float) env(
        'REDIS_LATENCY_CRITICAL_MS',
        100,
    ),

    'memory_warning_percent' => (float) env(
        'REDIS_MEMORY_WARNING_PERCENT',
        70,
    ),

    'memory_critical_percent' => (float) env(
        'REDIS_MEMORY_CRITICAL_PERCENT',
        85,
    ),

    'queue_warning_size' => (int) env(
        'REDIS_QUEUE_WARNING_SIZE',
        100,
    ),

    'queue_critical_size' => (int) env(
        'REDIS_QUEUE_CRITICAL_SIZE',
        500,
    ),

];
