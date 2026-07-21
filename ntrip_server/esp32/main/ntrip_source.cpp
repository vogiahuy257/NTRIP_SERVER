#include "ntrip_source.hpp"

#include <algorithm>
#include <cstdio>
#include <cstring>

#include "app_defaults.hpp"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "lwip/netdb.h"
#include "lwip/sockets.h"
#include "network_manager.hpp"
#include "station_state.hpp"

namespace
{
constexpr char TAG[] = "NTRIP_SOURCE";
}

esp_err_t NtripSource::initialize()
{
    q_ = xQueueCreate(
        app_defaults::RTCM_QUEUE_LENGTH,
        sizeof(RtcmFrame));

    if (q_ == nullptr) {
        return ESP_ERR_NO_MEM;
    }

    return xTaskCreate(
               &NtripSource::entry,
               "ntrip_source",
               6144,
               this,
               7,
               nullptr) == pdPASS
        ? ESP_OK
        : ESP_ERR_NO_MEM;
}

bool NtripSource::enqueue(const RtcmFrame &frame)
{
    cache(frame);

    if (xQueueSend(q_, &frame, 0) == pdTRUE) {
        return true;
    }

    StationState::instance().queue_drops++;
    return false;
}

void NtripSource::entry(void *context)
{
    static_cast<NtripSource *>(context)->task();
}

void NtripSource::task()
{
    auto &state = StationState::instance();
    uint32_t retry_ms = app_defaults::RETRY_MIN_MS;

    while (true) {
        network_manager::wait_connected();

        const RuntimeConfig config =
            RuntimeConfigManager::instance().snapshot();

        if (!config.enabled) {
            state.source_connected = false;
            xQueueReset(q_);
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        const int socket_fd = connect_socket(config);

        if (socket_fd < 0 || !handshake(socket_fd, config)) {
            if (socket_fd >= 0) {
                close(socket_fd);
            }

            /*
             * Before provisioning, retry at the discovery interval so the
             * Caster can keep pending_devices.last_seen_at up to date.
             */
            if (!config.provisioned) {
                retry_ms = app_defaults::RETRY_MIN_MS;
                vTaskDelay(pdMS_TO_TICKS(
                    config.provisioning_poll_interval_ms));
                continue;
            }

            const uint32_t jitter =
                esp_random() % app_defaults::RETRY_JITTER_MS;

            vTaskDelay(pdMS_TO_TICKS(retry_ms + jitter));
            retry_ms = std::min(
                retry_ms * 2,
                app_defaults::RETRY_MAX_MS);
            continue;
        }

        retry_ms = app_defaults::RETRY_MIN_MS;
        state.source_connected = true;
        xQueueReset(q_);

        if (!send_cache(socket_fd)) {
            state.source_connected = false;
            close(socket_fd);
            continue;
        }

        RtcmFrame frame{};

        while (network_manager::connected()) {
            const RuntimeConfig current =
                RuntimeConfigManager::instance().snapshot();

            if (
                !current.enabled ||
                !current.provisioned ||
                current.revision != config.revision) {
                break;
            }

            if (
                xQueueReceive(
                    q_,
                    &frame,
                    pdMS_TO_TICKS(1000)) != pdTRUE) {
                continue;
            }

            const int64_t age_us =
                esp_timer_get_time() - frame.received_us;

            if (
                age_us >
                static_cast<int64_t>(current.max_rtcm_age_ms) * 1000) {
                state.stale_drops++;
                continue;
            }

            if (!write_all(
                    socket_fd,
                    frame.data.data(),
                    frame.length)) {
                break;
            }

            state.bytes_sent += frame.length;
        }

        state.source_connected = false;
        shutdown(socket_fd, SHUT_RDWR);
        close(socket_fd);
    }
}

int NtripSource::connect_socket(const RuntimeConfig &config)
{
    char port[8]{};
    std::snprintf(
        port,
        sizeof(port),
        "%u",
        config.caster_port);

    addrinfo hints{};
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;

    addrinfo *results = nullptr;

    if (
        getaddrinfo(
            config.caster_host,
            port,
            &hints,
            &results) != 0 ||
        results == nullptr) {
        return -1;
    }

    int socket_fd = -1;

    for (addrinfo *item = results; item != nullptr; item = item->ai_next) {
        socket_fd = socket(
            item->ai_family,
            item->ai_socktype,
            item->ai_protocol);

        if (socket_fd < 0) {
            continue;
        }

        int enabled = 1;
        setsockopt(
            socket_fd,
            IPPROTO_TCP,
            TCP_NODELAY,
            &enabled,
            sizeof(enabled));
        setsockopt(
            socket_fd,
            SOL_SOCKET,
            SO_KEEPALIVE,
            &enabled,
            sizeof(enabled));

        timeval timeout{5, 0};
        setsockopt(
            socket_fd,
            SOL_SOCKET,
            SO_SNDTIMEO,
            &timeout,
            sizeof(timeout));
        setsockopt(
            socket_fd,
            SOL_SOCKET,
            SO_RCVTIMEO,
            &timeout,
            sizeof(timeout));

        if (
            connect(
                socket_fd,
                item->ai_addr,
                item->ai_addrlen) == 0) {
            break;
        }

        close(socket_fd);
        socket_fd = -1;
    }

    freeaddrinfo(results);
    return socket_fd;
}

bool NtripSource::handshake(
    const int socket_fd,
    const RuntimeConfig &config)
{
    const char *provisioning_state =
        config.provisioned ? "provisioned" : "bootstrap";

    char request[1024]{};

    const int request_length = std::snprintf(
        request,
        sizeof(request),
        "POST %s%s HTTP/1.1\r\n"
        "Host: %s:%u\r\n"
        "User-Agent: ESP32-NTRIP/%s\r\n"
        "Content-Type: gnss/data\r\n"
        "Connection: keep-alive\r\n"
        "X-Hardware-ID: %s\r\n"
        "X-Device-ID: %s\r\n"
        "X-Mountpoint: %s\r\n"
        "X-Firmware-Version: %s\r\n"
        "X-Provisioning-State: %s\r\n"
        "Authorization: Bearer %s\r\n"
        "\r\n",
        app_defaults::SOURCE_PATH_PREFIX,
        config.mountpoint,
        config.caster_host,
        config.caster_port,
        app_defaults::FIRMWARE_VERSION,
        config.hardware_id,
        config.device_id,
        config.mountpoint,
        app_defaults::FIRMWARE_VERSION,
        provisioning_state,
        config.auth_token);

    if (
        request_length <= 0 ||
        request_length >= static_cast<int>(sizeof(request)) ||
        !write_all(
            socket_fd,
            request,
            static_cast<std::size_t>(request_length))) {
        return false;
    }

    char response[512]{};
    std::size_t used = 0;

    while (used + 1 < sizeof(response)) {
        const int received = recv(
            socket_fd,
            response + used,
            sizeof(response) - used - 1,
            0);

        if (received <= 0) {
            return false;
        }

        used += static_cast<std::size_t>(received);
        response[used] = '\0';

        if (std::strstr(response, "\r\n\r\n") != nullptr) {
            break;
        }
    }

    if (std::strstr(response, " 200 ") != nullptr) {
        ESP_LOGI(
            TAG,
            "Source accepted: device=%s mountpoint=%s",
            config.device_id,
            config.mountpoint);
        return true;
    }

    if (std::strstr(response, "DEVICE_PENDING") != nullptr) {
        ESP_LOGI(
            TAG,
            "Device pending approval: hardware_id=%s",
            config.hardware_id);
    } else if (std::strstr(response, "DEVICE_REJECTED") != nullptr) {
        ESP_LOGW(
            TAG,
            "Device rejected: hardware_id=%s",
            config.hardware_id);
    } else {
        ESP_LOGW(TAG, "Source handshake rejected: %s", response);
    }

    return false;
}

bool NtripSource::write_all(
    const int socket_fd,
    const void *data,
    std::size_t length)
{
    const auto *cursor = static_cast<const uint8_t *>(data);

    while (length > 0) {
        const int sent = send(socket_fd, cursor, length, 0);

        if (sent <= 0) {
            return false;
        }

        cursor += sent;
        length -= static_cast<std::size_t>(sent);
    }

    return true;
}

int NtripSource::cache_index(const uint16_t type)
{
    return (type == 1005 || type == 1006)
        ? 0
        : type == 1033
        ? 1
        : type == 1230
        ? 2
        : type == 4072
        ? 3
        : -1;
}

void NtripSource::cache(const RtcmFrame &frame)
{
    const int index = cache_index(frame.type);

    if (index >= 0) {
        c_[index] = {frame, true};
    }
}

bool NtripSource::send_cache(const int socket_fd)
{
    for (const Cache &item : c_) {
        if (
            item.valid &&
            !write_all(
                socket_fd,
                item.f.data.data(),
                item.f.length)) {
            return false;
        }
    }

    return true;
}
