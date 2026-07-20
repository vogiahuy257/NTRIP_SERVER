
// bridge_metrics.c
// Separate metrics logger for NTRIP Client/Bridge on UAV.
// This file only records evaluation data. It does not change bridge logic.

#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define METRICS_CSV_PATH "ntrip_client_bridge_metrics.csv"
#define METRICS_INTERVAL_S 5.0
#define RTCM_MSG_MAX 4096

static pthread_mutex_t g_mtx = PTHREAD_MUTEX_INITIALIZER;
static pthread_t g_thread;
static int g_thread_started = 0;
static int g_running = 0;

static char g_interface[128] = "unknown";
static time_t g_start_time = 0;
static time_t g_last_report_time = 0;

static uint64_t g_ntrip_rx_bytes_total = 0;
static uint64_t g_ntrip_rx_bytes_interval = 0;

static uint64_t g_rtcm_frames_total = 0;
static uint64_t g_rtcm_frames_interval = 0;
static uint64_t g_rtcm_valid_total = 0;
static uint64_t g_rtcm_valid_interval = 0;
static uint64_t g_rtcm_bad_crc_total = 0;
static uint64_t g_rtcm_bad_crc_interval = 0;
static uint64_t g_rtcm_msg_counts[RTCM_MSG_MAX];

static uint64_t g_gps_rtcm_data_total = 0;
static uint64_t g_gps_rtcm_data_interval = 0;
static uint64_t g_px4_tx_bytes_total = 0;
static uint64_t g_px4_tx_bytes_interval = 0;
static uint64_t g_px4_tx_fail_total = 0;
static uint64_t g_px4_tx_fail_interval = 0;

static int g_ntrip_connected = 0;
static time_t g_connected_since = 0;
static double g_connected_accum_s = 0.0;

static FILE* g_csv = NULL;

static void timestamp_string(char* out, size_t out_len)
{
    time_t t = time(NULL);
    struct tm tmv;
    localtime_r(&t, &tmv);
    strftime(out, out_len, "%Y-%m-%d %H:%M:%S", &tmv);
}

static double connected_seconds_locked(time_t now)
{
    double s = g_connected_accum_s;
    if (g_ntrip_connected && g_connected_since > 0) {
        s += difftime(now, g_connected_since);
    }
    return s;
}

static void format_rtcm_types_locked(char* out, size_t out_len)
{
    size_t used = 0;
    int first = 1;
    out[0] = '\0';

    for (int i = 0; i < RTCM_MSG_MAX; ++i) {
        if (g_rtcm_msg_counts[i] == 0) {
            continue;
        }

        int n = snprintf(out + used, out_len > used ? out_len - used : 0,
                         "%s%d:%llu",
                         first ? "" : ",",
                         i,
                         (unsigned long long)g_rtcm_msg_counts[i]);
        if (n < 0) {
            return;
        }
        if ((size_t)n >= out_len - used) {
            return;
        }
        used += (size_t)n;
        first = 0;
    }

    if (first) {
        snprintf(out, out_len, "none");
    }
}

static void csv_open_if_needed_locked(void)
{
    if (g_csv) {
        return;
    }

    g_csv = fopen(METRICS_CSV_PATH, "a");
    if (!g_csv) {
        return;
    }

    long pos = ftell(g_csv);
    if (pos == 0) {
        fprintf(g_csv,
                "timestamp,uptime_min,ntrip_connected_min,interface,"
                "ntrip_rx_Bps,rtcm_frames_interval,rtcm_frames_total,"
                "rtcm_valid_interval,rtcm_valid_total,rtcm_bad_crc_interval,"
                "rtcm_bad_crc_total,crc_error_percent_interval,"
                "gps_rtcm_data_interval,gps_rtcm_data_total,"
                "px4_tx_Bps,px4_tx_fail_interval,px4_tx_fail_total,"
                "px4_tx_loss_est_percent,rtcm_message_types\n");
        fflush(g_csv);
    }
}

static void report_locked(time_t now)
{
    double dt = difftime(now, g_last_report_time);
    if (dt <= 0.0) {
        dt = METRICS_INTERVAL_S;
    }

    char ts[32];
    char types[2048];
    timestamp_string(ts, sizeof(ts));
    format_rtcm_types_locked(types, sizeof(types));

    double uptime_min = difftime(now, g_start_time) / 60.0;
    double connected_min = connected_seconds_locked(now) / 60.0;
    double ntrip_rx_Bps = (double)g_ntrip_rx_bytes_interval / dt;
    double px4_tx_Bps = (double)g_px4_tx_bytes_interval / dt;
    uint64_t rtcm_interval = g_rtcm_valid_interval + g_rtcm_bad_crc_interval;
    double crc_percent = rtcm_interval > 0 ?
        ((double)g_rtcm_bad_crc_interval * 100.0 / (double)rtcm_interval) : 0.0;
    double px4_loss = g_gps_rtcm_data_interval > 0 ?
        ((double)g_px4_tx_fail_interval * 100.0 / (double)g_gps_rtcm_data_interval) : 0.0;

    printf("[BRIDGE_METRICS] "
           "ntrip_rx=%.1f B/s, rtcm_frames=%llu, valid=%llu, bad_crc=%llu, "
           "crc_err=%.3f%%, gps_rtcm_data=%llu, px4_tx=%.1f B/s, "
           "px4_tx_fail=%llu, px4_loss_est=%.3f%%, interface=%s, connected=%.2f min, msg_types=%s\n",
           ntrip_rx_Bps,
           (unsigned long long)g_rtcm_frames_interval,
           (unsigned long long)g_rtcm_valid_interval,
           (unsigned long long)g_rtcm_bad_crc_interval,
           crc_percent,
           (unsigned long long)g_gps_rtcm_data_interval,
           px4_tx_Bps,
           (unsigned long long)g_px4_tx_fail_interval,
           px4_loss,
           g_interface,
           connected_min,
           types);

    printf("[REPORT_TABLE_3_4] "
           "rtcm_server_rx=%.1f byte/s | "
           "rtcm_frames_rx=%llu frame | "
           "rtcm_valid_after_crc=%llu frame | "
           "rtcm_crc_dropped=%llu frame | "
           "gps_rtcm_data_to_px4=%llu message | "
           "px4_tx_loss_est=%.3f%% | "
           "interface=%s | "
           "client_connected=%.2f min\n",
           ntrip_rx_Bps,
           (unsigned long long)g_rtcm_frames_total,
           (unsigned long long)g_rtcm_valid_total,
           (unsigned long long)g_rtcm_bad_crc_total,
           (unsigned long long)g_gps_rtcm_data_total,
           px4_loss,
           g_interface,
           connected_min);

    csv_open_if_needed_locked();
    if (g_csv) {
        fprintf(g_csv,
                "\"%s\",%.3f,%.3f,\"%s\",%.3f,%llu,%llu,%llu,%llu,%llu,%llu,%.6f,%llu,%llu,%.3f,%llu,%llu,%.6f,\"%s\"\n",
                ts,
                uptime_min,
                connected_min,
                g_interface,
                ntrip_rx_Bps,
                (unsigned long long)g_rtcm_frames_interval,
                (unsigned long long)g_rtcm_frames_total,
                (unsigned long long)g_rtcm_valid_interval,
                (unsigned long long)g_rtcm_valid_total,
                (unsigned long long)g_rtcm_bad_crc_interval,
                (unsigned long long)g_rtcm_bad_crc_total,
                crc_percent,
                (unsigned long long)g_gps_rtcm_data_interval,
                (unsigned long long)g_gps_rtcm_data_total,
                px4_tx_Bps,
                (unsigned long long)g_px4_tx_fail_interval,
                (unsigned long long)g_px4_tx_fail_total,
                px4_loss,
                types);
        fflush(g_csv);
    }

    g_ntrip_rx_bytes_interval = 0;
    g_rtcm_frames_interval = 0;
    g_rtcm_valid_interval = 0;
    g_rtcm_bad_crc_interval = 0;
    g_gps_rtcm_data_interval = 0;
    g_px4_tx_bytes_interval = 0;
    g_px4_tx_fail_interval = 0;
    g_last_report_time = now;
}

static void* metrics_thread_main(void* arg)
{
    (void)arg;

    while (1) {
        sleep((unsigned int)METRICS_INTERVAL_S);

        pthread_mutex_lock(&g_mtx);
        if (!g_running) {
            pthread_mutex_unlock(&g_mtx);
            break;
        }
        report_locked(time(NULL));
        pthread_mutex_unlock(&g_mtx);
    }

    return NULL;
}

void bridge_metrics_init(const char* interface_name)
{
    pthread_mutex_lock(&g_mtx);

    memset(g_rtcm_msg_counts, 0, sizeof(g_rtcm_msg_counts));

    if (interface_name && interface_name[0]) {
        snprintf(g_interface, sizeof(g_interface), "%s", interface_name);
    } else {
        snprintf(g_interface, sizeof(g_interface), "unknown");
    }

    g_start_time = time(NULL);
    g_last_report_time = g_start_time;

    g_ntrip_rx_bytes_total = 0;
    g_ntrip_rx_bytes_interval = 0;
    g_rtcm_frames_total = 0;
    g_rtcm_frames_interval = 0;
    g_rtcm_valid_total = 0;
    g_rtcm_valid_interval = 0;
    g_rtcm_bad_crc_total = 0;
    g_rtcm_bad_crc_interval = 0;
    g_gps_rtcm_data_total = 0;
    g_gps_rtcm_data_interval = 0;
    g_px4_tx_bytes_total = 0;
    g_px4_tx_bytes_interval = 0;
    g_px4_tx_fail_total = 0;
    g_px4_tx_fail_interval = 0;
    g_ntrip_connected = 0;
    g_connected_since = 0;
    g_connected_accum_s = 0.0;

    csv_open_if_needed_locked();

    pthread_mutex_unlock(&g_mtx);
}

void bridge_metrics_start(void)
{
    pthread_mutex_lock(&g_mtx);
    if (!g_thread_started) {
        g_running = 1;
        if (pthread_create(&g_thread, NULL, metrics_thread_main, NULL) == 0) {
            g_thread_started = 1;
        } else {
            g_running = 0;
        }
    }
    pthread_mutex_unlock(&g_mtx);
}

void bridge_metrics_stop(void)
{
    int join_needed = 0;

    pthread_mutex_lock(&g_mtx);
    if (g_thread_started) {
        g_running = 0;
        join_needed = 1;
    }
    pthread_mutex_unlock(&g_mtx);

    if (join_needed) {
        pthread_join(g_thread, NULL);
    }

    pthread_mutex_lock(&g_mtx);
    report_locked(time(NULL));
    if (g_csv) {
        fclose(g_csv);
        g_csv = NULL;
    }
    g_thread_started = 0;
    pthread_mutex_unlock(&g_mtx);
}

void bridge_metrics_set_ntrip_connected(int connected)
{
    time_t now = time(NULL);

    pthread_mutex_lock(&g_mtx);
    if (connected && !g_ntrip_connected) {
        g_ntrip_connected = 1;
        g_connected_since = now;
    } else if (!connected && g_ntrip_connected) {
        g_connected_accum_s += difftime(now, g_connected_since);
        g_connected_since = 0;
        g_ntrip_connected = 0;
    }
    pthread_mutex_unlock(&g_mtx);
}

void bridge_metrics_on_ntrip_rx_bytes(unsigned long long n)
{
    pthread_mutex_lock(&g_mtx);
    g_ntrip_rx_bytes_total += n;
    g_ntrip_rx_bytes_interval += n;
    pthread_mutex_unlock(&g_mtx);
}

void bridge_metrics_on_rtcm_frame(unsigned int msg_id,
                                  unsigned long long frame_len,
                                  int crc_ok)
{
    (void)frame_len;

    pthread_mutex_lock(&g_mtx);
    g_rtcm_frames_total++;
    g_rtcm_frames_interval++;

    if (crc_ok) {
        g_rtcm_valid_total++;
        g_rtcm_valid_interval++;
        if (msg_id < RTCM_MSG_MAX) {
            g_rtcm_msg_counts[msg_id]++;
        }
    } else {
        g_rtcm_bad_crc_total++;
        g_rtcm_bad_crc_interval++;
    }
    pthread_mutex_unlock(&g_mtx);
}

void bridge_metrics_on_gps_rtcm_data(unsigned long long mav_pkt_len,
                                     int write_ok)
{
    pthread_mutex_lock(&g_mtx);
    g_gps_rtcm_data_total++;
    g_gps_rtcm_data_interval++;
    if (write_ok) {
        g_px4_tx_bytes_total += mav_pkt_len;
        g_px4_tx_bytes_interval += mav_pkt_len;
    } else {
        g_px4_tx_fail_total++;
        g_px4_tx_fail_interval++;
    }
    pthread_mutex_unlock(&g_mtx);
}
