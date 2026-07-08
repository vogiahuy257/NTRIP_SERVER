// ntrip.hpp
// Standalone NTRIP -> MAVLink bridge for Raspberry Pi 5.
// Receives RTCM corrections from an NTRIP caster and forwards them to a
// flight controller (PX4) via MAVLink over UART or UDP.
//
// Header: class declarations only. Implementations live in ntrip.cc.

#pragma once

#include <atomic>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

namespace ntrip {

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

struct Config {
    // NTRIP caster
    std::string ntrip_host;
    int         ntrip_port      = 2101;
    std::string ntrip_mountpoint;
    std::string ntrip_user;
    std::string ntrip_password;
    bool        ntrip_use_tls   = false;   // TLS optional (not implemented here)

    // MAVLink transport
    std::string mavlink_type          = "serial";   // "serial" or "udp"
    std::string mavlink_serial_device = "/dev/serial0";
    int         mavlink_serial_baud   = 921600;
    std::string mavlink_udp_host      = "127.0.0.1";
    int         mavlink_udp_port      = 14550;

    // MAVLink identity
    int mavlink_sysid  = 255;   // our system id
    int mavlink_compid = 190;   // MAV_COMP_ID_MISSIONPLANNER
    int target_sysid   = 1;     // PX4
    int target_compid  = 1;

    // Fallback GGA position when no vehicle position is available yet.
    std::optional<double> fixed_lat;
    std::optional<double> fixed_lon;
    std::optional<double> fixed_alt;

    // Comma separated list of RTCM message IDs to forward. Empty = forward all.
    std::string rtcm_whitelist;

    // Load key=value pairs (# comments, blank lines ignored) into `cfg`.
    // Returns true on success. Missing fields keep defaults.
    static bool loadFromFile(const std::string& path, Config& cfg,
                             std::string* err = nullptr);
};

// ---------------------------------------------------------------------------
// Connection status (for UI / logging)
// ---------------------------------------------------------------------------

enum class ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error,
};

const char* toString(ConnectionStatus s);

// ---------------------------------------------------------------------------
// RTCM3 frame parser with CRC24Q validation.
// Ported from ntrip_qgc/RTCMParser.{h,cc}; Qt removed, pure C++.
// ---------------------------------------------------------------------------

static constexpr uint8_t kRtcm3Preamble = 0xD3;

class RTCMParser {
public:
    static constexpr int      kCrcSize       = 3;
    static constexpr uint16_t kMaxPayloadLen = 1023;
    static constexpr int      kHeaderSize    = 3;

    RTCMParser();

    void reset();
    // Feed one byte. Returns true when a full frame (header+payload+CRC) is
    // available in the internal buffer. The caller must then check
    // validateCrc() and consume message()/crcBytes() before calling reset().
    bool addByte(uint8_t byte);

    uint8_t*       message()             { return _buffer; }
    const uint8_t* message()       const { return _buffer; }
    uint16_t       messageLength() const { return _messageLength; }
    uint16_t       messageId()     const;
    const uint8_t* crcBytes()      const { return _crcBytes; }

    bool            validateCrc() const;
    static uint32_t crc24q(const uint8_t* data, size_t len);

private:
    enum State {
        WaitingForPreamble,
        ReadingLength,
        ReadingMessage,
        ReadingCRC,
    };

    State    _state           = WaitingForPreamble;
    uint8_t  _buffer[kHeaderSize + kMaxPayloadLen]{};
    uint16_t _messageLength   = 0;
    uint16_t _bytesRead       = 0;
    uint16_t _lengthBytesRead = 0;
    uint8_t  _lengthBytes[2]{};
    uint16_t _crcBytesRead    = 0;
    uint8_t  _crcBytes[kCrcSize]{};
};

// ---------------------------------------------------------------------------
// NTRIPClient - TCP socket + HTTP handshake, streams RTCM frames.
// ---------------------------------------------------------------------------

class NTRIPClient {
public:
    using RtcmCallback   = std::function<void(const uint8_t* data, size_t len,
                                              uint16_t msgId)>;
    using StatusCallback = std::function<void(ConnectionStatus,
                                              const std::string&)>;

    NTRIPClient();
    ~NTRIPClient();

    NTRIPClient(const NTRIPClient&)            = delete;
    NTRIPClient& operator=(const NTRIPClient&) = delete;

    void setRtcmCallback(RtcmCallback cb)     { _onRtcm   = std::move(cb); }
    void setStatusCallback(StatusCallback cb) { _onStatus = std::move(cb); }

    bool start(const Config& cfg);
    void stop();

    // Thread-safe. Sends a NMEA sentence (e.g. $GPGGA...) up to the caster.
    // Appends \r\n if missing and repairs checksum.
    void sendNMEA(const std::string& nmea);

private:
    void threadMain();
    bool connectSocket(std::string* err);
    bool sendHttpHandshake(std::string* err);
    bool readHttpResponse(std::string* err);
    void readLoop();
    void parseRtcmBytes(const uint8_t* data, size_t len);
    void closeSocket();

    void setStatus(ConnectionStatus s, const std::string& msg);
    bool isWhitelisted(uint16_t msgId) const;

    static std::string base64(const std::string& s);
    static std::string repairNmeaChecksum(const std::string& sentence);

    Config               _cfg;
    std::atomic<bool>    _running{false};
    std::thread          _thread;

    std::mutex           _sockMtx;
    int                  _sockFd = -1;

    RtcmCallback         _onRtcm;
    StatusCallback       _onStatus;

    RTCMParser           _parser;
    std::vector<int>     _whitelist;

    // Used to wake threadMain() out of its backoff sleep during stop().
    std::mutex              _wakeMtx;
    std::condition_variable _wakeCv;
};

// ---------------------------------------------------------------------------
// MAVLinkBridge - UART or UDP MAVLink I/O.
// ---------------------------------------------------------------------------

class MAVLinkBridge {
public:
    using PositionCallback = std::function<void(double lat_deg,
                                                double lon_deg,
                                                double alt_msl_m)>;

    MAVLinkBridge();
    ~MAVLinkBridge();

    MAVLinkBridge(const MAVLinkBridge&)            = delete;
    MAVLinkBridge& operator=(const MAVLinkBridge&) = delete;

    void setPositionCallback(PositionCallback cb) { _onPosition = std::move(cb); }

    bool start(const Config& cfg);
    void stop();

    // Fragment & send RTCM as one or more GPS_RTCM_DATA messages.
    // Thread-safe.
    void sendRTCM(const uint8_t* data, size_t len);

private:
    void readLoop();
    bool openSerial(std::string* err);
    bool openUdp(std::string* err);
    void closeFd();
    bool writeBytes(const uint8_t* data, size_t len);

    Config               _cfg;
    std::atomic<bool>    _running{false};
    std::thread          _thread;

    std::mutex           _fdMtx;
    int                  _fd    = -1;
    bool                 _isUdp = false;

    // Outgoing sequence counter for RTCM fragmentation.
    std::mutex           _txMtx;
    uint8_t              _sequenceId = 0;

    PositionCallback     _onPosition;
};

// ---------------------------------------------------------------------------
// NTRIPBridge - top level orchestrator.
// ---------------------------------------------------------------------------

class NTRIPBridge {
public:
    NTRIPBridge();
    ~NTRIPBridge();

    NTRIPBridge(const NTRIPBridge&)            = delete;
    NTRIPBridge& operator=(const NTRIPBridge&) = delete;

    // Start everything, block until stop() is called.
    // Returns 0 on clean shutdown, non-zero on fatal startup error.
    int  run(const Config& cfg);

    // Thread-safe. Signal the run() loop to exit.
    void stop();

private:
    void ggaLoop();
    std::string makeGGA(double lat, double lon, double alt_msl) const;

    Config             _cfg;
    NTRIPClient        _ntrip;
    MAVLinkBridge      _mav;

    std::atomic<bool>  _running{false};
    std::thread        _ggaThread;

    std::mutex                _wakeMtx;
    std::condition_variable   _wakeCv;

    std::mutex                _posMtx;
    bool                      _havePos = false;
    double                    _posLat  = 0.0;
    double                    _posLon  = 0.0;
    double                    _posAlt  = 0.0;
};

// ---------------------------------------------------------------------------
// Logger (simple stderr, timestamped).
// ---------------------------------------------------------------------------

void log_impl(const char* level, const char* fmt, ...)
    __attribute__((format(printf, 2, 3)));

#define LOG_INFO(fmt, ...)  ::ntrip::log_impl("INFO",  fmt, ##__VA_ARGS__)
#define LOG_WARN(fmt, ...)  ::ntrip::log_impl("WARN",  fmt, ##__VA_ARGS__)
#define LOG_ERROR(fmt, ...) ::ntrip::log_impl("ERROR", fmt, ##__VA_ARGS__)

} // namespace ntrip
