// ntrip.cc
// Standalone NTRIP -> MAVLink bridge implementation.

#include "ntrip.hpp"

#include <algorithm>
#include <cctype>
#include <cerrno>
#include <chrono>
#include <cmath>
#include <csignal>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

// POSIX / networking
#include <arpa/inet.h>
#include <fcntl.h>
#include <netdb.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <termios.h>
#include <unistd.h>

// MAVLink v2 C headers (provided by CMake FetchContent).
#define MAVLINK_NO_CONVERSION_HELPERS
#include <mavlink/common/mavlink.h>

extern "C" {
void bridge_metrics_init(const char* interface_name);
void bridge_metrics_start(void);
void bridge_metrics_stop(void);
void bridge_metrics_set_ntrip_connected(int connected);
void bridge_metrics_on_ntrip_rx_bytes(unsigned long long n);
void bridge_metrics_on_rtcm_frame(unsigned int msg_id,
                                  unsigned long long frame_len,
                                  int crc_ok);
void bridge_metrics_on_gps_rtcm_data(unsigned long long mav_pkt_len,
                                     int write_ok);
}

namespace ntrip {

// ===========================================================================
// Logger
// ===========================================================================

namespace {
std::mutex g_log_mtx;
} // namespace

void log_impl(const char* level, const char* fmt, ...) {
    using namespace std::chrono;
    const auto now = system_clock::now();
    const auto tt  = system_clock::to_time_t(now);
    const auto ms  = duration_cast<milliseconds>(now.time_since_epoch()) % 1000;
    std::tm tm_{};
    localtime_r(&tt, &tm_);
    char tbuf[32];
    std::strftime(tbuf, sizeof(tbuf), "%Y-%m-%d %H:%M:%S", &tm_);

    char msgbuf[1024];
    va_list ap;
    va_start(ap, fmt);
    std::vsnprintf(msgbuf, sizeof(msgbuf), fmt, ap);
    va_end(ap);

    std::lock_guard<std::mutex> lock(g_log_mtx);
    std::fprintf(stderr, "[%s.%03lld] [%s] %s\n",
                 tbuf, static_cast<long long>(ms.count()), level, msgbuf);
    std::fflush(stderr);
}

const char* toString(ConnectionStatus s) {
    switch (s) {
    case ConnectionStatus::Disconnected: return "Disconnected";
    case ConnectionStatus::Connecting:   return "Connecting";
    case ConnectionStatus::Connected:    return "Connected";
    case ConnectionStatus::Reconnecting: return "Reconnecting";
    case ConnectionStatus::Error:        return "Error";
    }
    return "?";
}

// ===========================================================================
// Config loader
// ===========================================================================

namespace {

std::string trim(const std::string& s) {
    size_t a = 0;
    while (a < s.size() && std::isspace(static_cast<unsigned char>(s[a]))) ++a;
    size_t b = s.size();
    while (b > a && std::isspace(static_cast<unsigned char>(s[b - 1]))) --b;
    return s.substr(a, b - a);
}

bool toBool(const std::string& v) {
    std::string s;
    s.reserve(v.size());
    for (char c : v) s.push_back(static_cast<char>(std::tolower(
                                 static_cast<unsigned char>(c))));
    return s == "1" || s == "true" || s == "yes" || s == "on";
}

} // namespace

bool Config::loadFromFile(const std::string& path, Config& cfg,
                          std::string* err) {
    std::ifstream f(path);
    if (!f.is_open()) {
        if (err) *err = "cannot open config file: " + path;
        return false;
    }

    std::string line;
    int lineno = 0;
    while (std::getline(f, line)) {
        ++lineno;
        std::string t = trim(line);
        if (t.empty() || t[0] == '#') continue;

        auto eq = t.find('=');
        if (eq == std::string::npos) {
            if (err) *err = "malformed line " + std::to_string(lineno) +
                            " (no '='): " + t;
            return false;
        }
        std::string key = trim(t.substr(0, eq));
        std::string val = trim(t.substr(eq + 1));

        // Strip optional surrounding quotes.
        if (val.size() >= 2 &&
            ((val.front() == '"' && val.back() == '"') ||
             (val.front() == '\'' && val.back() == '\''))) {
            val = val.substr(1, val.size() - 2);
        }

        try {
            if      (key == "ntrip_host")            cfg.ntrip_host = val;
            else if (key == "ntrip_port")            cfg.ntrip_port = std::stoi(val);
            else if (key == "ntrip_mountpoint")      cfg.ntrip_mountpoint = val;
            else if (key == "ntrip_user")            cfg.ntrip_user = val;
            else if (key == "ntrip_password")        cfg.ntrip_password = val;
            else if (key == "ntrip_use_tls")         cfg.ntrip_use_tls = toBool(val);
            else if (key == "mavlink_type")          cfg.mavlink_type = val;
            else if (key == "mavlink_serial_device") cfg.mavlink_serial_device = val;
            else if (key == "mavlink_serial_baud")   cfg.mavlink_serial_baud = std::stoi(val);
            else if (key == "mavlink_udp_host")      cfg.mavlink_udp_host = val;
            else if (key == "mavlink_udp_port")      cfg.mavlink_udp_port = std::stoi(val);
            else if (key == "mavlink_sysid")         cfg.mavlink_sysid = std::stoi(val);
            else if (key == "mavlink_compid")        cfg.mavlink_compid = std::stoi(val);
            else if (key == "target_sysid")          cfg.target_sysid = std::stoi(val);
            else if (key == "target_compid")         cfg.target_compid = std::stoi(val);
            else if (key == "fixed_lat")             cfg.fixed_lat = std::stod(val);
            else if (key == "fixed_lon")             cfg.fixed_lon = std::stod(val);
            else if (key == "fixed_alt")             cfg.fixed_alt = std::stod(val);
            else if (key == "rtcm_whitelist")        cfg.rtcm_whitelist = val;
            else LOG_WARN("config: unknown key '%s' on line %d", key.c_str(), lineno);
        } catch (const std::exception& e) {
            if (err) *err = "bad value for " + key + " on line " +
                            std::to_string(lineno) + ": " + e.what();
            return false;
        }
    }
    return true;
}

// ===========================================================================
// RTCMParser (verbatim port of ntrip_qgc/RTCMParser.cc)
// ===========================================================================

RTCMParser::RTCMParser() { reset(); }

void RTCMParser::reset() {
    _state           = WaitingForPreamble;
    _messageLength   = 0;
    _bytesRead       = 0;
    _lengthBytesRead = 0;
    _crcBytesRead    = 0;
}

bool RTCMParser::addByte(uint8_t byte) {
    switch (_state) {
    case WaitingForPreamble:
        if (byte == kRtcm3Preamble) {
            _buffer[0]      = byte;
            _bytesRead      = 1;
            _state          = ReadingLength;
            _lengthBytesRead = 0;
        }
        break;

    case ReadingLength:
        _lengthBytes[_lengthBytesRead++] = byte;
        _buffer[_bytesRead++] = byte;
        if (_lengthBytesRead == 2) {
            _messageLength = ((_lengthBytes[0] & 0x03) << 8) | _lengthBytes[1];
            if (_messageLength > 0 && _messageLength <= kMaxPayloadLen) {
                _state = ReadingMessage;
            } else {
                reset();
            }
        }
        break;

    case ReadingMessage:
        if (_bytesRead < kHeaderSize + kMaxPayloadLen) {
            _buffer[_bytesRead++] = byte;
        }
        if (_bytesRead >= _messageLength + kHeaderSize) {
            _state        = ReadingCRC;
            _crcBytesRead = 0;
        }
        break;

    case ReadingCRC:
        _crcBytes[_crcBytesRead++] = byte;
        if (_crcBytesRead == kCrcSize) {
            return true;
        }
        break;
    }
    return false;
}

uint16_t RTCMParser::messageId() const {
    if (_messageLength >= 2) {
        return ((_buffer[3] << 4) | (_buffer[4] >> 4)) & 0xFFF;
    }
    return 0;
}

uint32_t RTCMParser::crc24q(const uint8_t* data, size_t len) {
    static constexpr uint32_t kPoly = 0x1864CFB;
    uint32_t crc = 0;
    for (size_t i = 0; i < len; ++i) {
        crc ^= static_cast<uint32_t>(data[i]) << 16;
        for (int j = 0; j < 8; ++j) {
            crc <<= 1;
            if (crc & 0x1000000) {
                crc ^= kPoly;
            }
        }
    }
    return crc & 0xFFFFFF;
}

bool RTCMParser::validateCrc() const {
    if (_messageLength == 0 || _bytesRead < kHeaderSize + _messageLength) {
        return false;
    }
    const uint32_t computed = crc24q(_buffer, kHeaderSize + _messageLength);
    const uint32_t received = (static_cast<uint32_t>(_crcBytes[0]) << 16) |
                              (static_cast<uint32_t>(_crcBytes[1]) << 8)  |
                               static_cast<uint32_t>(_crcBytes[2]);
    return computed == received;
}

// ===========================================================================
// NTRIPClient
// ===========================================================================

NTRIPClient::NTRIPClient()  = default;
NTRIPClient::~NTRIPClient() { stop(); }

std::string NTRIPClient::base64(const std::string& in) {
    static const char tbl[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    int val = 0, valb = -6;
    for (unsigned char c : in) {
        val = (val << 8) | c;
        valb += 8;
        while (valb >= 0) {
            out.push_back(tbl[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) out.push_back(tbl[((val << 8) >> (valb + 8)) & 0x3F]);
    while (out.size() % 4) out.push_back('=');
    return out;
}

std::string NTRIPClient::repairNmeaChecksum(const std::string& sentence) {
    std::string line = sentence;
    // Strip trailing newlines for processing.
    while (!line.empty() && (line.back() == '\r' || line.back() == '\n')) {
        line.pop_back();
    }

    if (line.size() >= 5 && line.front() == '$') {
        auto star = line.rfind('*');
        if (star != std::string::npos && star > 1) {
            uint8_t calc = 0;
            for (size_t i = 1; i < star; ++i) {
                calc ^= static_cast<uint8_t>(line[i]);
            }
            char cks[3];
            std::snprintf(cks, sizeof(cks), "%02X", calc);

            bool needsRepair = false;
            if (star + 3 > line.size()) {
                needsRepair = true;
            } else {
                std::string tx = line.substr(star + 1, 2);
                for (auto& c : tx) c = static_cast<char>(std::toupper(
                                        static_cast<unsigned char>(c)));
                if (tx != cks) needsRepair = true;
            }
            if (needsRepair) {
                line = line.substr(0, star + 1) + cks;
            }
        } else {
            uint8_t calc = 0;
            for (size_t i = 1; i < line.size(); ++i) {
                calc ^= static_cast<uint8_t>(line[i]);
            }
            char cks[3];
            std::snprintf(cks, sizeof(cks), "%02X", calc);
            line += '*';
            line += cks;
        }
    }

    line += "\r\n";
    return line;
}

void NTRIPClient::setStatus(ConnectionStatus s, const std::string& msg) {
    LOG_INFO("ntrip status: %s (%s)", toString(s), msg.c_str());
    bridge_metrics_set_ntrip_connected(s == ConnectionStatus::Connected ? 1 : 0);
    if (_onStatus) _onStatus(s, msg);
}

bool NTRIPClient::isWhitelisted(uint16_t msgId) const {
    if (_whitelist.empty()) return true;
    return std::find(_whitelist.begin(), _whitelist.end(),
                     static_cast<int>(msgId)) != _whitelist.end();
}

bool NTRIPClient::start(const Config& cfg) {
    if (_running.load()) return false;
    _cfg = cfg;

    _whitelist.clear();
    if (!_cfg.rtcm_whitelist.empty()) {
        std::stringstream ss(_cfg.rtcm_whitelist);
        std::string tok;
        while (std::getline(ss, tok, ',')) {
            tok = trim(tok);
            if (tok.empty()) continue;
            try {
                int id = std::stoi(tok);
                if (id > 0) _whitelist.push_back(id);
            } catch (...) {
                LOG_WARN("ntrip: bad whitelist entry '%s'", tok.c_str());
            }
        }
    }

    if (_cfg.ntrip_use_tls) {
        LOG_WARN("ntrip: TLS requested but not compiled in; using plain TCP");
    }

    _running.store(true);
    _thread = std::thread(&NTRIPClient::threadMain, this);
    return true;
}

void NTRIPClient::stop() {
    if (!_running.exchange(false)) return;
    {
        std::lock_guard<std::mutex> lk(_wakeMtx);
        _wakeCv.notify_all();
    }
    closeSocket();
    if (_thread.joinable()) _thread.join();
}

void NTRIPClient::closeSocket() {
    std::lock_guard<std::mutex> lk(_sockMtx);
    if (_sockFd >= 0) {
        ::shutdown(_sockFd, SHUT_RDWR);
        ::close(_sockFd);
        _sockFd = -1;
    }
}

bool NTRIPClient::connectSocket(std::string* err) {
    struct addrinfo hints{};
    hints.ai_family   = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    struct addrinfo* res = nullptr;
    const std::string port = std::to_string(_cfg.ntrip_port);
    int rc = ::getaddrinfo(_cfg.ntrip_host.c_str(), port.c_str(), &hints, &res);
    if (rc != 0 || !res) {
        if (err) *err = std::string("getaddrinfo: ") + gai_strerror(rc);
        return false;
    }

    int fd = -1;
    for (auto* p = res; p != nullptr; p = p->ai_next) {
        fd = ::socket(p->ai_family, p->ai_socktype, p->ai_protocol);
        if (fd < 0) continue;

        // Set 10s connect timeout via non-blocking + poll.
        int flags = ::fcntl(fd, F_GETFL, 0);
        ::fcntl(fd, F_SETFL, flags | O_NONBLOCK);

        int cr = ::connect(fd, p->ai_addr, p->ai_addrlen);
        if (cr == 0) {
            ::fcntl(fd, F_SETFL, flags);
            break;
        }
        if (errno != EINPROGRESS) {
            ::close(fd);
            fd = -1;
            continue;
        }

        struct pollfd pfd{fd, POLLOUT, 0};
        int pr = ::poll(&pfd, 1, 10000);
        if (pr <= 0) {
            ::close(fd);
            fd = -1;
            continue;
        }

        int soerr = 0;
        socklen_t sl = sizeof(soerr);
        if (::getsockopt(fd, SOL_SOCKET, SO_ERROR, &soerr, &sl) < 0 ||
            soerr != 0) {
            ::close(fd);
            fd = -1;
            continue;
        }

        ::fcntl(fd, F_SETFL, flags);
        break;
    }
    ::freeaddrinfo(res);

    if (fd < 0) {
        if (err) *err = "connect failed: " + std::string(std::strerror(errno));
        return false;
    }

    int one = 1;
    ::setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &one, sizeof(one));
    ::setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));

    // RX timeout so readLoop wakes up periodically and notices _running=false.
    struct timeval tv{5, 0};
    ::setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    {
        std::lock_guard<std::mutex> lk(_sockMtx);
        _sockFd = fd;
    }
    return true;
}

bool NTRIPClient::sendHttpHandshake(std::string* err) {
    std::string req;
    req += "GET /" + _cfg.ntrip_mountpoint + " HTTP/1.0\r\n";
    req += "Host: " + _cfg.ntrip_host + "\r\n";
    req += "Ntrip-Version: Ntrip/2.0\r\n";
    req += "User-Agent: NTRIP PiNtripBridge/1.0\r\n";
    if (!_cfg.ntrip_user.empty() || !_cfg.ntrip_password.empty()) {
        req += "Authorization: Basic " +
               base64(_cfg.ntrip_user + ":" + _cfg.ntrip_password) + "\r\n";
    }
    req += "\r\n";

    int fd;
    { std::lock_guard<std::mutex> lk(_sockMtx); fd = _sockFd; }
    if (fd < 0) { if (err) *err = "socket closed"; return false; }

    const char* p  = req.data();
    size_t       n = req.size();
    while (n > 0) {
        ssize_t w = ::send(fd, p, n, MSG_NOSIGNAL);
        if (w < 0) {
            if (errno == EINTR) continue;
            if (err) *err = std::string("send: ") + std::strerror(errno);
            return false;
        }
        p += w;
        n -= static_cast<size_t>(w);
    }
    return true;
}

bool NTRIPClient::readHttpResponse(std::string* err) {
    // Read until we see \r\n\r\n or timeout.
    std::string buf;
    buf.reserve(1024);

    int fd;
    { std::lock_guard<std::mutex> lk(_sockMtx); fd = _sockFd; }

    constexpr size_t kMaxHdr = 16 * 1024;
    const auto deadline =
        std::chrono::steady_clock::now() + std::chrono::seconds(10);

    while (_running.load()) {
        if (std::chrono::steady_clock::now() > deadline) {
            if (err) *err = "http response timeout";
            return false;
        }
        char tmp[512];
        ssize_t r = ::recv(fd, tmp, sizeof(tmp), 0);
        if (r < 0) {
            if (errno == EINTR) continue;
            if (errno == EAGAIN || errno == EWOULDBLOCK) continue;
            if (err) *err = std::string("recv: ") + std::strerror(errno);
            return false;
        }
        if (r == 0) {
            if (err) *err = "peer closed during HTTP handshake";
            return false;
        }
        buf.append(tmp, static_cast<size_t>(r));
        auto pos = buf.find("\r\n\r\n");
        if (pos != std::string::npos) {
            std::string header = buf.substr(0, pos);
            std::string rest   = buf.substr(pos + 4);

            // Parse status line (first line).
            auto nl = header.find("\r\n");
            std::string statusLine = (nl == std::string::npos)
                                     ? header : header.substr(0, nl);
            // Format: "HTTP/1.1 200 OK" or "ICY 200 OK"
            int code = 0;
            {
                std::istringstream is(statusLine);
                std::string proto, reason;
                is >> proto >> code;
                std::getline(is, reason);
            }

            if (code >= 200 && code < 300) {
                LOG_INFO("ntrip: HTTP %d, handshake complete (%zu trailing bytes)",
                         code, rest.size());
                if (!rest.empty()) {
                    bridge_metrics_on_ntrip_rx_bytes(static_cast<unsigned long long>(rest.size()));
                    parseRtcmBytes(reinterpret_cast<const uint8_t*>(rest.data()),
                                   rest.size());
                }
                return true;
            }
            if (code == 401) {
                if (err) *err = "HTTP 401 unauthorized (check user/password)";
            } else if (code == 404) {
                if (err) *err = "HTTP 404 not found (check mountpoint)";
            } else if (code == 0) {
                if (err) *err = "invalid HTTP response: " + statusLine;
            } else {
                if (err) *err = "HTTP " + std::to_string(code) +
                                ": " + statusLine;
            }
            return false;
        }
        if (buf.size() > kMaxHdr) {
            if (err) *err = "HTTP response header too large";
            return false;
        }
    }
    if (err) *err = "stopped during HTTP handshake";
    return false;
}

void NTRIPClient::parseRtcmBytes(const uint8_t* data, size_t len) {
    for (size_t i = 0; i < len; ++i) {
        if (!_parser.addByte(data[i])) continue;

        const uint16_t id          = _parser.messageId();
        const uint16_t payload_len = _parser.messageLength();
        const size_t   frame_len   = static_cast<size_t>(RTCMParser::kHeaderSize)
                                   + payload_len
                                   + static_cast<size_t>(RTCMParser::kCrcSize);

        if (!_parser.validateCrc()) {
            bridge_metrics_on_rtcm_frame(static_cast<unsigned>(id),
                                         static_cast<unsigned long long>(frame_len),
                                         0);
            LOG_WARN("ntrip: RTCM CRC mismatch, dropping (id=%u)",
                     static_cast<unsigned>(id));
            _parser.reset();
            continue;
        }

        // Assemble a contiguous buffer: header+payload then 3-byte CRC.
        uint8_t frame[RTCMParser::kHeaderSize + RTCMParser::kMaxPayloadLen +
                      RTCMParser::kCrcSize];
        std::memcpy(frame, _parser.message(),
                    RTCMParser::kHeaderSize + payload_len);
        std::memcpy(frame + RTCMParser::kHeaderSize + payload_len,
                    _parser.crcBytes(), RTCMParser::kCrcSize);

        bridge_metrics_on_rtcm_frame(static_cast<unsigned>(id),
                                     static_cast<unsigned long long>(frame_len),
                                     1);

        if (isWhitelisted(id)) {
            if (_onRtcm) _onRtcm(frame, frame_len, id);
        } else {
            LOG_INFO("ntrip: dropping RTCM id %u (not in whitelist)", id);
        }
        _parser.reset();
    }
}

void NTRIPClient::readLoop() {
    std::vector<uint8_t> buf(4096);
    int fd;
    { std::lock_guard<std::mutex> lk(_sockMtx); fd = _sockFd; }

    while (_running.load()) {
        ssize_t r = ::recv(fd, buf.data(), buf.size(), 0);
        if (r < 0) {
            if (errno == EINTR) continue;
            if (errno == EAGAIN || errno == EWOULDBLOCK) continue;
            LOG_WARN("ntrip: recv error: %s", std::strerror(errno));
            return;
        }
        if (r == 0) {
            LOG_WARN("ntrip: server closed connection");
            return;
        }
        bridge_metrics_on_ntrip_rx_bytes(static_cast<unsigned long long>(r));
        parseRtcmBytes(buf.data(), static_cast<size_t>(r));
    }
}

void NTRIPClient::threadMain() {
    int attempts = 0;
    while (_running.load()) {
        setStatus(ConnectionStatus::Connecting,
                  "connecting to " + _cfg.ntrip_host + ":" +
                  std::to_string(_cfg.ntrip_port));

        _parser.reset();

        std::string err;
        if (!connectSocket(&err)) {
            setStatus(ConnectionStatus::Error, err);
        } else if (!sendHttpHandshake(&err)) {
            setStatus(ConnectionStatus::Error, err);
            closeSocket();
        } else if (!readHttpResponse(&err)) {
            setStatus(ConnectionStatus::Error, err);
            closeSocket();
        } else {
            attempts = 0;
            setStatus(ConnectionStatus::Connected, "streaming RTCM");
            readLoop();
            closeSocket();
            if (_running.load()) {
                setStatus(ConnectionStatus::Reconnecting, "stream ended");
            }
        }

        if (!_running.load()) break;

        int backoffMs = 1000 * (1 << std::min(attempts, 4));
        if (backoffMs > 30000) backoffMs = 30000;
        ++attempts;
        LOG_INFO("ntrip: reconnecting in %d ms (attempt %d)", backoffMs, attempts);

        std::unique_lock<std::mutex> lk(_wakeMtx);
        _wakeCv.wait_for(lk, std::chrono::milliseconds(backoffMs),
                         [this] { return !_running.load(); });
    }

    setStatus(ConnectionStatus::Disconnected, "stopped");
}

void NTRIPClient::sendNMEA(const std::string& nmea) {
    if (!_running.load()) return;
    std::string line = repairNmeaChecksum(nmea);

    std::lock_guard<std::mutex> lk(_sockMtx);
    if (_sockFd < 0) return;
    const char* p = line.data();
    size_t      n = line.size();
    while (n > 0) {
        ssize_t w = ::send(_sockFd, p, n, MSG_NOSIGNAL);
        if (w < 0) {
            if (errno == EINTR) continue;
            LOG_WARN("ntrip: NMEA send failed: %s", std::strerror(errno));
            return;
        }
        p += w;
        n -= static_cast<size_t>(w);
    }
}

// ===========================================================================
// MAVLinkBridge
// ===========================================================================

MAVLinkBridge::MAVLinkBridge()  = default;
MAVLinkBridge::~MAVLinkBridge() { stop(); }

namespace {

speed_t baudToSpeed(int baud) {
    switch (baud) {
    case 9600:    return B9600;
    case 19200:   return B19200;
    case 38400:   return B38400;
    case 57600:   return B57600;
    case 115200:  return B115200;
    case 230400:  return B230400;
    case 460800:  return B460800;
    case 500000:  return B500000;
    case 576000:  return B576000;
    case 921600:  return B921600;
    case 1000000: return B1000000;
    case 1152000: return B1152000;
    case 1500000: return B1500000;
    case 2000000: return B2000000;
    default:      return B0;
    }
}

} // namespace

bool MAVLinkBridge::openSerial(std::string* err) {
    int fd = ::open(_cfg.mavlink_serial_device.c_str(),
                    O_RDWR | O_NOCTTY | O_NONBLOCK);
    if (fd < 0) {
        if (err) *err = "open " + _cfg.mavlink_serial_device + ": " +
                         std::strerror(errno);
        return false;
    }

    struct termios tio{};
    if (::tcgetattr(fd, &tio) < 0) {
        if (err) *err = std::string("tcgetattr: ") + std::strerror(errno);
        ::close(fd);
        return false;
    }

    cfmakeraw(&tio);
    speed_t sp = baudToSpeed(_cfg.mavlink_serial_baud);
    if (sp == B0) {
        if (err) *err = "unsupported baud " +
                         std::to_string(_cfg.mavlink_serial_baud);
        ::close(fd);
        return false;
    }
    cfsetispeed(&tio, sp);
    cfsetospeed(&tio, sp);

    tio.c_cflag |=  (CLOCAL | CREAD);
    tio.c_cflag &= ~PARENB;
    tio.c_cflag &= ~CSTOPB;
    tio.c_cflag &= ~CSIZE;
    tio.c_cflag |=  CS8;
    tio.c_cflag &= ~CRTSCTS;

    tio.c_cc[VMIN]  = 0;
    tio.c_cc[VTIME] = 1;  // 0.1s read timeout

    if (::tcsetattr(fd, TCSANOW, &tio) < 0) {
        if (err) *err = std::string("tcsetattr: ") + std::strerror(errno);
        ::close(fd);
        return false;
    }

    {
        std::lock_guard<std::mutex> lk(_fdMtx);
        _fd    = fd;
        _isUdp = false;
    }
    LOG_INFO("mavlink: serial %s @ %d opened",
             _cfg.mavlink_serial_device.c_str(), _cfg.mavlink_serial_baud);
    return true;
}

bool MAVLinkBridge::openUdp(std::string* err) {
    int fd = ::socket(AF_INET, SOCK_DGRAM, 0);
    if (fd < 0) {
        if (err) *err = std::string("socket: ") + std::strerror(errno);
        return false;
    }

    // Resolve target.
    struct sockaddr_in dst{};
    dst.sin_family = AF_INET;
    dst.sin_port   = htons(static_cast<uint16_t>(_cfg.mavlink_udp_port));
    if (::inet_pton(AF_INET, _cfg.mavlink_udp_host.c_str(), &dst.sin_addr) != 1) {
        // fallback: getaddrinfo
        struct addrinfo hints{};
        hints.ai_family   = AF_INET;
        hints.ai_socktype = SOCK_DGRAM;
        struct addrinfo* res = nullptr;
        int rc = ::getaddrinfo(_cfg.mavlink_udp_host.c_str(), nullptr, &hints,
                               &res);
        if (rc != 0 || !res) {
            if (err) *err = std::string("getaddrinfo: ") + gai_strerror(rc);
            ::close(fd);
            return false;
        }
        dst.sin_addr =
            reinterpret_cast<sockaddr_in*>(res->ai_addr)->sin_addr;
        ::freeaddrinfo(res);
    }

    // connect() fixes the peer so send()/recv() work, and discards datagrams
    // from other sources.
    if (::connect(fd, reinterpret_cast<sockaddr*>(&dst), sizeof(dst)) < 0) {
        if (err) *err = std::string("udp connect: ") + std::strerror(errno);
        ::close(fd);
        return false;
    }

    struct timeval tv{1, 0};
    ::setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    {
        std::lock_guard<std::mutex> lk(_fdMtx);
        _fd    = fd;
        _isUdp = true;
    }
    LOG_INFO("mavlink: udp %s:%d open",
             _cfg.mavlink_udp_host.c_str(), _cfg.mavlink_udp_port);
    return true;
}

bool MAVLinkBridge::start(const Config& cfg) {
    if (_running.load()) return false;
    _cfg = cfg;

    std::string err;
    bool ok = false;
    if (_cfg.mavlink_type == "serial") {
        ok = openSerial(&err);
    } else if (_cfg.mavlink_type == "udp") {
        ok = openUdp(&err);
    } else {
        err = "unknown mavlink_type: " + _cfg.mavlink_type;
    }
    if (!ok) {
        LOG_ERROR("mavlink: %s", err.c_str());
        return false;
    }

    _running.store(true);
    _thread = std::thread(&MAVLinkBridge::readLoop, this);
    return true;
}

void MAVLinkBridge::stop() {
    if (!_running.exchange(false)) return;
    closeFd();
    if (_thread.joinable()) _thread.join();
}

void MAVLinkBridge::closeFd() {
    std::lock_guard<std::mutex> lk(_fdMtx);
    if (_fd >= 0) {
        ::close(_fd);
        _fd = -1;
    }
}

bool MAVLinkBridge::writeBytes(const uint8_t* data, size_t len) {
    std::lock_guard<std::mutex> lk(_fdMtx);
    if (_fd < 0) return false;
    size_t n = len;
    const uint8_t* p = data;
    while (n > 0) {
        ssize_t w;
        if (_isUdp) {
            w = ::send(_fd, p, n, MSG_NOSIGNAL);
        } else {
            w = ::write(_fd, p, n);
        }
        if (w < 0) {
            if (errno == EINTR) continue;
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                // Brief wait and retry on serial backpressure.
                struct pollfd pfd{_fd, POLLOUT, 0};
                ::poll(&pfd, 1, 100);
                continue;
            }
            LOG_WARN("mavlink: write error: %s", std::strerror(errno));
            return false;
        }
        p += w;
        n -= static_cast<size_t>(w);
    }
    return true;
}

void MAVLinkBridge::sendRTCM(const uint8_t* data, size_t len) {
    if (!_running.load()) return;

    constexpr size_t kMaxField = MAVLINK_MSG_GPS_RTCM_DATA_FIELD_DATA_LEN;  // 180
    constexpr size_t kMaxLogical = kMaxField * 4;                          // 720

    if (len > kMaxLogical) {
        LOG_WARN("mavlink: RTCM frame too large (%zu > %zu bytes), truncating",
                 len, kMaxLogical);
        len = kMaxLogical;
    }

    uint8_t seq;
    {
        std::lock_guard<std::mutex> lk(_txMtx);
        seq = _sequenceId++;
    }

    mavlink_gps_rtcm_data_t msg{};

    auto encodeAndSend = [&](const mavlink_gps_rtcm_data_t& m) {
        mavlink_message_t mm;
        (void) mavlink_msg_gps_rtcm_data_encode(
            static_cast<uint8_t>(_cfg.mavlink_sysid),
            static_cast<uint8_t>(_cfg.mavlink_compid),
            &mm, &m);
        uint8_t outbuf[MAVLINK_MAX_PACKET_LEN];
        uint16_t n = mavlink_msg_to_send_buffer(outbuf, &mm);
        const bool write_ok = writeBytes(outbuf, n);
        bridge_metrics_on_gps_rtcm_data(static_cast<unsigned long long>(n),
                                        write_ok ? 1 : 0);
    };

    if (len < kMaxField) {
        msg.len   = static_cast<uint8_t>(len);
        msg.flags = static_cast<uint8_t>((seq & 0x1FU) << 3);
        std::memcpy(msg.data, data, len);
        encodeAndSend(msg);
    } else {
        uint8_t fragmentId = 0;
        size_t  start      = 0;
        while (start < len) {
            msg.flags  = 0x01U;                                  // fragmented
            msg.flags |= static_cast<uint8_t>(fragmentId++ << 1);// frag id
            msg.flags |= static_cast<uint8_t>((seq & 0x1FU) << 3);// seq
            size_t chunk = std::min(len - start, kMaxField);
            msg.len = static_cast<uint8_t>(chunk);
            std::memcpy(msg.data, data + start, chunk);
            encodeAndSend(msg);
            start += chunk;
        }
    }
}

void MAVLinkBridge::readLoop() {
    mavlink_message_t msg;
    mavlink_status_t  status;
    uint8_t buf[1024];

    int fd;
    { std::lock_guard<std::mutex> lk(_fdMtx); fd = _fd; }

    while (_running.load()) {
        ssize_t r;
        if (_isUdp) {
            r = ::recv(fd, buf, sizeof(buf), 0);
        } else {
            struct pollfd pfd{fd, POLLIN, 0};
            int pr = ::poll(&pfd, 1, 500);
            if (pr <= 0) continue;
            r = ::read(fd, buf, sizeof(buf));
        }
        if (r < 0) {
            if (errno == EINTR) continue;
            if (errno == EAGAIN || errno == EWOULDBLOCK) continue;
            LOG_WARN("mavlink: read error: %s", std::strerror(errno));
            continue;
        }
        if (r == 0) continue;

        for (ssize_t i = 0; i < r; ++i) {
            if (mavlink_parse_char(MAVLINK_COMM_0, buf[i], &msg, &status)) {
                if (msg.msgid == MAVLINK_MSG_ID_GLOBAL_POSITION_INT) {
                    mavlink_global_position_int_t gp;
                    mavlink_msg_global_position_int_decode(&msg, &gp);
                    const double lat = gp.lat * 1e-7;
                    const double lon = gp.lon * 1e-7;
                    const double alt = gp.alt * 1e-3;   // mm -> m MSL
                    if (_onPosition) _onPosition(lat, lon, alt);
                }
            }
        }
    }
}

// ===========================================================================
// NTRIPBridge
// ===========================================================================

NTRIPBridge::NTRIPBridge()  = default;
NTRIPBridge::~NTRIPBridge() { stop(); }

std::string NTRIPBridge::makeGGA(double lat, double lon, double alt_msl) const {
    // UTC time
    const auto now = std::chrono::system_clock::now();
    const std::time_t tt = std::chrono::system_clock::to_time_t(now);
    std::tm utc{};
    gmtime_r(&tt, &utc);
    char hhmmss[8];
    std::snprintf(hhmmss, sizeof(hhmmss), "%02d%02d%02d",
                  utc.tm_hour, utc.tm_min, utc.tm_sec);

    auto dmm = [](double deg, bool isLat) -> std::string {
        double a = std::fabs(deg);
        int d    = static_cast<int>(a);
        double m = (a - d) * 60.0;

        long   m10000    = static_cast<long>(m * 10000.0 + 0.5);
        double m_rounded = m10000 / 10000.0;
        if (m_rounded >= 60.0) {
            m_rounded -= 60.0;
            d += 1;
        }

        char mm[16];
        std::snprintf(mm, sizeof(mm), "%s%.4f",
                      (m_rounded < 10.0 ? "0" : ""), m_rounded);

        char out[32];
        if (isLat) std::snprintf(out, sizeof(out), "%02d%s", d, mm);
        else       std::snprintf(out, sizeof(out), "%03d%s", d, mm);
        return std::string(out);
    };

    const bool latN = lat >= 0.0;
    const bool lonE = lon >= 0.0;

    char altbuf[32];
    std::snprintf(altbuf, sizeof(altbuf), "%.1f", alt_msl);

    std::string core = "GPGGA,";
    core += hhmmss;           core += ',';
    core += dmm(lat, true);   core += ',';
    core += (latN ? "N" : "S"); core += ',';
    core += dmm(lon, false);  core += ',';
    core += (lonE ? "E" : "W"); core += ',';
    core += "1,12,1.0,";
    core += altbuf;
    core += ",M,0.0,M,,";

    uint8_t cksum = 0;
    for (char c : core) cksum ^= static_cast<uint8_t>(c);
    char cks[3];
    std::snprintf(cks, sizeof(cks), "%02X", cksum);

    std::string sentence = "$";
    sentence += core;
    sentence += '*';
    sentence += cks;
    return sentence;
}

void NTRIPBridge::ggaLoop() {
    while (_running.load()) {
        // Pick best position.
        double lat = 0, lon = 0, alt = 0;
        bool   have = false;
        {
            std::lock_guard<std::mutex> lk(_posMtx);
            if (_havePos) {
                lat  = _posLat;
                lon  = _posLon;
                alt  = _posAlt;
                have = true;
            }
        }
        if (!have && _cfg.fixed_lat && _cfg.fixed_lon) {
            lat = *_cfg.fixed_lat;
            lon = *_cfg.fixed_lon;
            alt = _cfg.fixed_alt.value_or(0.0);
            have = true;
        }

        if (have) {
            std::string gga = makeGGA(lat, lon, alt);
            _ntrip.sendNMEA(gga);
            LOG_INFO("gga: %s", gga.c_str());
        }

        std::unique_lock<std::mutex> lk(_wakeMtx);
        _wakeCv.wait_for(lk, std::chrono::seconds(5),
                         [this] { return !_running.load(); });
    }
}

int NTRIPBridge::run(const Config& cfg) {
    _cfg = cfg;

    std::string metrics_interface;
    if (_cfg.mavlink_type == "serial") {
        metrics_interface = _cfg.mavlink_serial_device + "@" +
                            std::to_string(_cfg.mavlink_serial_baud);
    } else if (_cfg.mavlink_type == "udp") {
        metrics_interface = "udp://" + _cfg.mavlink_udp_host + ":" +
                            std::to_string(_cfg.mavlink_udp_port);
    } else {
        metrics_interface = _cfg.mavlink_type;
    }
    bridge_metrics_init(metrics_interface.c_str());
    bridge_metrics_start();

    if (_cfg.ntrip_host.empty()) {
        LOG_ERROR("config: ntrip_host is required");
        bridge_metrics_stop();
        return 1;
    }
    if (_cfg.ntrip_mountpoint.empty()) {
        LOG_ERROR("config: ntrip_mountpoint is required");
        bridge_metrics_stop();
        return 1;
    }
    if (_cfg.ntrip_port <= 0 || _cfg.ntrip_port > 65535) {
        LOG_ERROR("config: invalid ntrip_port %d", _cfg.ntrip_port);
        bridge_metrics_stop();
        return 1;
    }

    // Wire up callbacks.
    _mav.setPositionCallback([this](double lat, double lon, double alt) {
        std::lock_guard<std::mutex> lk(_posMtx);
        if (!std::isfinite(lat) || !std::isfinite(lon)) return;
        if (lat == 0.0 && lon == 0.0) return;
        if (std::fabs(lat) > 90.0 || std::fabs(lon) > 180.0) return;
        _havePos = true;
        _posLat  = lat;
        _posLon  = lon;
        _posAlt  = std::isfinite(alt) ? alt : 0.0;
    });

    _ntrip.setRtcmCallback([this](const uint8_t* d, size_t n, uint16_t id) {
        LOG_INFO("rtcm: id=%u len=%zu -> mavlink", id, n);
        _mav.sendRTCM(d, n);
    });
    _ntrip.setStatusCallback([](ConnectionStatus s, const std::string& m) {
        LOG_INFO("ntrip-status: %s (%s)", toString(s), m.c_str());
    });

    if (!_mav.start(_cfg)) {
        LOG_ERROR("failed to start MAVLink bridge");
        bridge_metrics_stop();
        return 1;
    }
    if (!_ntrip.start(_cfg)) {
        LOG_ERROR("failed to start NTRIP client");
        _mav.stop();
        bridge_metrics_stop();
        return 1;
    }

    _running.store(true);
    _ggaThread = std::thread(&NTRIPBridge::ggaLoop, this);

    // Wait for stop() to be called.
    {
        std::unique_lock<std::mutex> lk(_wakeMtx);
        _wakeCv.wait(lk, [this] { return !_running.load(); });
    }

    LOG_INFO("shutting down...");
    _ntrip.stop();
    _mav.stop();
    if (_ggaThread.joinable()) _ggaThread.join();
    bridge_metrics_stop();
    LOG_INFO("bye");
    return 0;
}

void NTRIPBridge::stop() {
    if (!_running.exchange(false)) return;
    std::lock_guard<std::mutex> lk(_wakeMtx);
    _wakeCv.notify_all();
}

} // namespace ntrip

// ===========================================================================
// main()
// ===========================================================================

namespace {

ntrip::NTRIPBridge* g_bridge = nullptr;

void handleSignal(int) {
    if (g_bridge) g_bridge->stop();
}

void printHelp(const char* prog) {
    std::fprintf(stderr,
        "Usage: %s --config /path/to/config.conf [--help]\n\n"
        "Config file is key=value, '#' for comments. Example:\n"
        "  ntrip_host=rtk2go.com\n"
        "  ntrip_port=2101\n"
        "  ntrip_mountpoint=MYBASE\n"
        "  ntrip_user=email@example.com\n"
        "  ntrip_password=password\n"
        "  mavlink_type=serial\n"
        "  mavlink_serial_device=/dev/serial0\n"
        "  mavlink_serial_baud=921600\n"
        "  # or mavlink_type=udp / mavlink_udp_host / mavlink_udp_port\n"
        "  target_sysid=1\n"
        "  target_compid=1\n"
        "  fixed_lat=10.7626\n"
        "  fixed_lon=106.6602\n"
        "  fixed_alt=10.0\n"
        "  rtcm_whitelist=1005,1074,1084,1094,1124,1230\n",
        prog);
}

} // namespace

int main(int argc, char** argv) {
    std::string configPath;

    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--help" || a == "-h") {
            printHelp(argv[0]);
            return 0;
        } else if ((a == "--config" || a == "-c") && (i + 1) < argc) {
            configPath = argv[++i];
        } else if (a.rfind("--config=", 0) == 0) {
            configPath = a.substr(std::string("--config=").size());
        } else {
            std::fprintf(stderr, "unknown argument: %s\n", a.c_str());
            printHelp(argv[0]);
            return 1;
        }
    }

    if (configPath.empty()) {
        std::fprintf(stderr, "error: --config is required\n");
        printHelp(argv[0]);
        return 1;
    }

    ntrip::Config cfg;
    std::string   err;
    if (!ntrip::Config::loadFromFile(configPath, cfg, &err)) {
        std::fprintf(stderr, "config error: %s\n", err.c_str());
        return 1;
    }

    ntrip::LOG_INFO("starting ntrip bridge, config=%s", configPath.c_str());

    ntrip::NTRIPBridge bridge;
    g_bridge = &bridge;

    // Install signal handlers.
    struct sigaction sa{};
    sa.sa_handler = handleSignal;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    ::sigaction(SIGINT,  &sa, nullptr);
    ::sigaction(SIGTERM, &sa, nullptr);

    // Ignore SIGPIPE — writes that would raise it return EPIPE instead.
    struct sigaction sp{};
    sp.sa_handler = SIG_IGN;
    sigemptyset(&sp.sa_mask);
    ::sigaction(SIGPIPE, &sp, nullptr);

    int rc = bridge.run(cfg);
    g_bridge = nullptr;
    return rc;
}
