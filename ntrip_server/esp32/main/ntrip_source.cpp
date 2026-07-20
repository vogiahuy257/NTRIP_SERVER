#include "ntrip_source.hpp"
#include <algorithm>
#include <cstdio>
#include <cstring>
#include "app_defaults.hpp"
#include "esp_random.h"
#include "esp_timer.h"
#include "lwip/netdb.h"
#include "lwip/sockets.h"
#include "network_manager.hpp"
#include "station_state.hpp"
esp_err_t NtripSource::initialize()
{
    q_ = xQueueCreate(app_defaults::RTCM_QUEUE_LENGTH, sizeof(RtcmFrame));
    if (!q_)
        return ESP_ERR_NO_MEM;
    return xTaskCreate(&NtripSource::entry, "ntrip_source", 6144, this, 7, nullptr) == pdPASS ? ESP_OK : ESP_ERR_NO_MEM;
}
bool NtripSource::enqueue(const RtcmFrame &f)
{
    cache(f);
    if (xQueueSend(q_, &f, 0) == pdTRUE)
        return true;
    StationState::instance().queue_drops++;
    return false;
}
void NtripSource::entry(void *x) { ((NtripSource *)x)->task(); }
void NtripSource::task()
{
    auto &s = StationState::instance();
    uint32_t r = app_defaults::RETRY_MIN_MS;
    while (true)
    {
        network_manager::wait_connected();
        auto c = RuntimeConfigManager::instance().snapshot();
        if (!c.enabled)
        {
            s.source_connected = false;
            xQueueReset(q_);
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }
        int fd = connect_socket(c);
        if (fd < 0 || !handshake(fd, c))
        {
            if (fd >= 0)
                close(fd);
            uint32_t d = r + esp_random() % app_defaults::RETRY_JITTER_MS;
            vTaskDelay(pdMS_TO_TICKS(d));
            r = std::min(r * 2, app_defaults::RETRY_MAX_MS);
            continue;
        }
        r = app_defaults::RETRY_MIN_MS;
        s.source_connected = true;
        xQueueReset(q_);
        if (!send_cache(fd))
        {
            s.source_connected = false;
            close(fd);
            continue;
        }
        RtcmFrame f{};
        while (network_manager::connected())
        {
            auto now = RuntimeConfigManager::instance().snapshot();
            if (!now.enabled || now.revision != c.revision)
                break;
            if (xQueueReceive(q_, &f, pdMS_TO_TICKS(1000)) != pdTRUE)
                continue;
            if (esp_timer_get_time() - f.received_us > (int64_t)now.max_rtcm_age_ms * 1000)
            {
                s.stale_drops++;
                continue;
            }
            if (!write_all(fd, f.data.data(), f.length))
                break;
            s.bytes_sent += f.length;
        }
        s.source_connected = false;
        shutdown(fd, SHUT_RDWR);
        close(fd);
    }
}
int NtripSource::connect_socket(const RuntimeConfig &c)
{
    char p[8];
    std::snprintf(p, sizeof(p), "%u", c.caster_port);
    addrinfo h{};
    h.ai_family = AF_INET;
    h.ai_socktype = SOCK_STREAM;
    h.ai_protocol = IPPROTO_TCP;
    addrinfo *r = nullptr;
    if (getaddrinfo(c.caster_host, p, &h, &r) != 0 || !r)
        return -1;
    int fd = -1;
    for (auto *i = r; i; i = i->ai_next)
    {
        fd = socket(i->ai_family, i->ai_socktype, i->ai_protocol);
        if (fd < 0)
            continue;
        int on = 1;
        setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &on, sizeof(on));
        setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &on, sizeof(on));
        timeval t{5, 0};
        setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &t, sizeof(t));
        setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &t, sizeof(t));
        if (connect(fd, i->ai_addr, i->ai_addrlen) == 0)
            break;
        close(fd);
        fd = -1;
    }
    freeaddrinfo(r);
    return fd;
}
bool NtripSource::handshake(int fd, const RuntimeConfig &c)
{
    char q[768];
    int n = std::snprintf(q, sizeof(q), "POST %s%s HTTP/1.1\r\nHost: %s:%u\r\nUser-Agent: ESP32-NTRIP/%s\r\nContent-Type: gnss/data\r\nConnection: keep-alive\r\nX-Device-ID: %s\r\nX-Mountpoint: %s\r\nAuthorization: Bearer %s\r\n\r\n", app_defaults::SOURCE_PATH_PREFIX, c.mountpoint, c.caster_host, c.caster_port, app_defaults::FIRMWARE_VERSION, app_defaults::DEVICE_ID, c.mountpoint, c.auth_token);
    if (n <= 0 || !write_all(fd, q, n))
        return false;
    char r[384]{};
    size_t u = 0;
    while (u + 1 < sizeof(r))
    {
        int k = recv(fd, r + u, sizeof(r) - u - 1, 0);
        if (k <= 0)
            return false;
        u += k;
        r[u] = 0;
        if (std::strstr(r, "\r\n\r\n"))
            break;
    }
    return std::strstr(r, " 200 ");
}
bool NtripSource::write_all(int fd, const void *d, size_t n)
{
    auto *p = (const uint8_t *)d;
    while (n)
    {
        int k = send(fd, p, n, 0);
        if (k <= 0)
            return false;
        p += k;
        n -= k;
    }
    return true;
}
int NtripSource::cache_index(uint16_t t) { return (t == 1005 || t == 1006) ? 0 : t == 1033 ? 1
                                                                             : t == 1230   ? 2
                                                                             : t == 4072   ? 3
                                                                                           : -1; }
void NtripSource::cache(const RtcmFrame &f)
{
    int i = cache_index(f.type);
    if (i >= 0)
        c_[i] = {f, true};
}
bool NtripSource::send_cache(int fd)
{
    for (auto &i : c_)
        if (i.valid && !write_all(fd, i.f.data.data(), i.f.length))
            return false;
    return true;
}
