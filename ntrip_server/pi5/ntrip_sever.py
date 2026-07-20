#!/usr/bin/env python3
import argparse
import base64
import csv
import os
import signal
import socket
import serial
import struct
import threading
import time
from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Optional


# =========================
# RTCM3 CRC24Q
# =========================
CRC24Q_POLY = 0x1864CFB


def crc24q(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b << 16
        for _ in range(8):
            crc <<= 1
            if crc & 0x1000000:
                crc ^= CRC24Q_POLY
    return crc & 0xFFFFFF


def rtcm_msg_type(frame: bytes) -> int:
    # RTCM frame: D3 | length | payload | CRC
    payload = frame[3:-3]
    if len(payload) < 2:
        return -1
    return (payload[0] << 4) | (payload[1] >> 4)


# =========================
# UBX parser for NAV-SVIN
# =========================
def ubx_checksum(data: bytes):
    ck_a = 0
    ck_b = 0

    for b in data:
        ck_a = (ck_a + b) & 0xFF
        ck_b = (ck_b + ck_a) & 0xFF

    return ck_a, ck_b


@dataclass
class SurveyInStatus:
    seen: bool = False
    i_tow_ms: int = 0
    dur_s: int = 0
    mean_acc_m: float = 0.0
    obs: int = 0
    valid: int = 0
    active: int = 0
    last_update: float = 0.0

    def state(self) -> str:
        if not self.seen:
            return "NO_UBX_NAV_SVIN"

        if self.active == 1 and self.valid == 0:
            return "SURVEYING"

        if self.active == 1 and self.valid == 1:
            return "SURVEYING_VALID"

        if self.active == 0 and self.valid == 1:
            return "DONE"

        return "INACTIVE_NOT_VALID"


# =========================
# Data structures
# =========================
@dataclass
class Client:
    conn: socket.socket
    addr: tuple
    user_agent: str = ""
    connected_at: float = field(default_factory=time.time)
    bytes_sent: int = 0
    frames_sent: int = 0


class NtripCaster:
    def __init__(
        self,
        serial_port: str,
        baud: int,
        host: str,
        port: int,
        mountpoint: str,
        username: Optional[str],
        password: Optional[str],
        send_http_200: bool,
        debug_rtcm: bool,
        debug_hex: bool,
        max_hex_bytes: int,
        log_interval: float,
        source_name: str,
        country: str,
        latitude: float,
        longitude: float,
        metrics_csv: str,
        report_interval: float,
    ):
        self.serial_port = serial_port
        self.baud = baud
        self.host = host
        self.port = port
        self.mountpoint = mountpoint.strip("/")

        self.username = username
        self.password = password
        self.auth_enabled = bool(username and password)

        self.send_http_200 = send_http_200
        self.debug_rtcm = debug_rtcm
        self.debug_hex = debug_hex
        self.max_hex_bytes = max_hex_bytes
        self.log_interval = log_interval

        self.source_name = source_name
        self.country = country
        self.latitude = latitude
        self.longitude = longitude

        self.metrics_csv = metrics_csv
        self.report_interval = report_interval
        self.start_time = time.time()
        self.last_report_table_time = self.start_time

        self.clients = []
        self.clients_lock = threading.Lock()

        self.rtcm_buffer = bytearray()
        self.rtcm_msg_counter = Counter()

        self.station_cache = {}
        self.last_frames = deque(maxlen=20)

        self.running = True

        self.total_serial_bytes = 0
        self.total_valid_frames = 0
        self.total_parsed_frames = 0
        self.total_bad_crc = 0
        self.total_client_bytes = 0
        self.peak_clients = 0

        self.last_rtcm_time = 0.0

        # UBX-NAV-SVIN monitor
        self.ubx_buffer = bytearray()
        self.svin = SurveyInStatus()
        self.last_svin_state = None
        self.svin_done_notified = False

        # RTCM base-position indicator
        self.last_station_pos_time = 0.0
        self.last_station_pos_type = None

    # =========================
    # RTCM parser
    # =========================
    def parse_rtcm_stream(self, data: bytes):
        self.rtcm_buffer.extend(data)

        parsed_frames = []
        valid_frames = []

        while True:
            if len(self.rtcm_buffer) < 3:
                break

            # Find 0xD3 preamble
            if self.rtcm_buffer[0] != 0xD3:
                try:
                    idx = self.rtcm_buffer.index(0xD3)
                    del self.rtcm_buffer[:idx]
                except ValueError:
                    self.rtcm_buffer.clear()
                    break

            if len(self.rtcm_buffer) < 3:
                break

            length = ((self.rtcm_buffer[1] & 0x03) << 8) | self.rtcm_buffer[2]
            frame_len = 3 + length + 3

            # Sanity check RTCM length
            if length <= 0 or length > 1023:
                del self.rtcm_buffer[0]
                continue

            if len(self.rtcm_buffer) < frame_len:
                break

            frame = bytes(self.rtcm_buffer[:frame_len])
            del self.rtcm_buffer[:frame_len]

            received_crc = int.from_bytes(frame[3 + length:3 + length + 3], "big")
            calculated_crc = crc24q(frame[:3 + length])
            crc_ok = received_crc == calculated_crc

            msg_type = rtcm_msg_type(frame)

            parsed_frames.append({
                "type": msg_type,
                "payload_len": length,
                "frame_len": frame_len,
                "crc_ok": crc_ok,
            })
            self.total_parsed_frames += 1

            if crc_ok:
                self.rtcm_msg_counter[msg_type] += 1
                self.total_valid_frames += 1
                self.last_rtcm_time = time.time()

                # Cache important station frames for new clients.
                # 1005/1006 = base station antenna reference position.
                # 1033 = receiver/antenna descriptor.
                # 1230 = GLONASS code-phase bias.
                # 4072 = u-blox proprietary message.
                if msg_type in (1005, 1006, 1033, 1230, 4072):
                    self.station_cache[msg_type] = frame

                # RTCM 1005/1006 means base station position is being broadcast.
                if msg_type in (1005, 1006):
                    self.last_station_pos_time = time.time()
                    self.last_station_pos_type = msg_type

                self.last_frames.append(frame)
                valid_frames.append(frame)
            else:
                self.total_bad_crc += 1

            if self.debug_rtcm:
                status = "OK" if crc_ok else "BAD"
                print(
                    f"[RTCM FRAME] type={msg_type}, "
                    f"payload_len={length}, "
                    f"frame_len={frame_len}, "
                    f"crc={status}"
                )

        return parsed_frames, valid_frames

    # =========================
    # UBX NAV-SVIN parser
    # =========================
    def parse_ubx_stream(self, data: bytes):
        self.ubx_buffer.extend(data)

        while True:
            if len(self.ubx_buffer) < 8:
                break

            # Find UBX sync: B5 62
            if not (self.ubx_buffer[0] == 0xB5 and self.ubx_buffer[1] == 0x62):
                try:
                    idx = self.ubx_buffer.index(0xB5)
                    del self.ubx_buffer[:idx]
                except ValueError:
                    self.ubx_buffer.clear()
                    break

            if len(self.ubx_buffer) < 8:
                break

            if self.ubx_buffer[0] != 0xB5 or self.ubx_buffer[1] != 0x62:
                del self.ubx_buffer[0]
                continue

            msg_class = self.ubx_buffer[2]
            msg_id = self.ubx_buffer[3]
            length = self.ubx_buffer[4] | (self.ubx_buffer[5] << 8)
            packet_len = 6 + length + 2

            if length > 4096:
                del self.ubx_buffer[0]
                continue

            if len(self.ubx_buffer) < packet_len:
                break

            packet = bytes(self.ubx_buffer[:packet_len])
            del self.ubx_buffer[:packet_len]

            ck_a_rx = packet[-2]
            ck_b_rx = packet[-1]

            ck_a, ck_b = ubx_checksum(packet[2:-2])

            if ck_a != ck_a_rx or ck_b != ck_b_rx:
                continue

            payload = packet[6:-2]

            # UBX-NAV-SVIN: class=0x01, id=0x3B
            if msg_class == 0x01 and msg_id == 0x3B:
                self.handle_nav_svin(payload)

    def handle_nav_svin(self, payload: bytes):
        # UBX-NAV-SVIN payload length is normally 40 bytes on ZED-F9P.
        if len(payload) < 40:
            return

        try:
            version = payload[0]

            # UBX-NAV-SVIN layout:
            # version U1, reserved[3],
            # iTOW U4, dur U4,
            # meanX/Y/Z I4,
            # meanXHP/YHP/ZHP I1,
            # reserved U1,
            # meanAcc U4, obs U4,
            # valid U1, active U1,
            # reserved[2]
            i_tow_ms = struct.unpack_from("<I", payload, 4)[0]
            dur_s = struct.unpack_from("<I", payload, 8)[0]
            mean_acc_raw = struct.unpack_from("<I", payload, 28)[0]
            obs = struct.unpack_from("<I", payload, 32)[0]
            valid = payload[36]
            active = payload[37]

            # meanAcc unit is 0.1 mm = 0.0001 m
            mean_acc_m = mean_acc_raw * 0.0001

            self.svin = SurveyInStatus(
                seen=True,
                i_tow_ms=i_tow_ms,
                dur_s=dur_s,
                mean_acc_m=mean_acc_m,
                obs=obs,
                valid=valid,
                active=active,
                last_update=time.time(),
            )

            state = self.svin.state()

            # Print immediately when state changes
            if state != self.last_svin_state:
                print(
                    f"[SVIN] STATE_CHANGE {self.last_svin_state} -> {state} | "
                    f"dur={dur_s}s, obs={obs}, acc={mean_acc_m:.4f}m, "
                    f"valid={valid}, active={active}, version={version}"
                )
                self.last_svin_state = state

            # Important one-shot message when survey-in completes
            if state == "DONE" and not self.svin_done_notified:
                print(
                    f"[SVIN] DONE: survey-in completed | "
                    f"dur={dur_s}s, obs={obs}, acc={mean_acc_m:.4f}m"
                )
                self.svin_done_notified = True

            # If receiver starts survey-in again, allow DONE notification again.
            if state in ("SURVEYING", "SURVEYING_VALID"):
                self.svin_done_notified = False

        except Exception as e:
            print(f"[SVIN] parse error: {e}")

    def svin_summary(self) -> str:
        age = time.time() - self.svin.last_update if self.svin.seen else -1

        if not self.svin.seen:
            return "NO_UBX_NAV_SVIN"

        return (
            f"{self.svin.state()} "
            f"dur={self.svin.dur_s}s "
            f"obs={self.svin.obs} "
            f"acc={self.svin.mean_acc_m:.4f}m "
            f"valid={self.svin.valid} "
            f"active={self.svin.active} "
            f"age={age:.1f}s"
        )

    def station_summary(self) -> str:
        if self.last_station_pos_time <= 0:
            return "NO_1005_1006"

        age = time.time() - self.last_station_pos_time
        return f"RTCM{self.last_station_pos_type} age={age:.1f}s"

    # =========================
    # NTRIP protocol
    # =========================
    def read_http_request(self, conn: socket.socket) -> str:
        conn.settimeout(5.0)
        request = b""

        while b"\r\n\r\n" not in request and len(request) < 8192:
            chunk = conn.recv(1024)
            if not chunk:
                break
            request += chunk

        return request.decode("ascii", errors="ignore")

    def parse_headers(self, request: str):
        lines = request.splitlines()
        first_line = lines[0] if lines else ""

        headers = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()

        return first_line, headers

    def check_auth(self, headers: dict) -> bool:
        if not self.auth_enabled:
            return True

        auth = headers.get("authorization", "")

        if not auth.lower().startswith("basic "):
            return False

        token = auth.split(" ", 1)[1].strip()

        try:
            decoded = base64.b64decode(token).decode("utf-8")
        except Exception:
            return False

        expected = f"{self.username}:{self.password}"
        return decoded == expected

    def send_unauthorized(self, conn: socket.socket):
        response = (
            "HTTP/1.1 401 Unauthorized\r\n"
            "WWW-Authenticate: Basic realm=\"NTRIP\"\r\n"
            "Connection: close\r\n"
            "\r\n"
        )
        conn.sendall(response.encode("ascii"))

    def send_not_found(self, conn: socket.socket):
        response = (
            "HTTP/1.1 404 Not Found\\r\\n"
            "Connection: close\\r\\n"
            "\\r\\n"
        )
        conn.sendall(response.encode("ascii"))

    def build_sourcetable(self) -> str:
        # Source table response for u-center and common NTRIP clients.
        # u-center needs a real HTTP response with Content-Length,
        # then the NTRIP source-table body containing STR;BASE;...
        auth_flag = "B" if self.auth_enabled else "N"

        body = (
            "SOURCETABLE 200 OK\\r\\n"
            f"STR;{self.mountpoint};{self.source_name};RTCM 3.3;"
            "1005(1),1077(1),1087(1),1097(1),1127(1),1230(1);"
            f"2;GPS+GLO+GAL+BDS;LOCAL;{self.country};"
            f"{self.latitude:.8f};{self.longitude:.8f};"
            f"0;0;u-blox_ZED-F9P;none;{auth_flag};N;0;\\r\\n"
            "ENDSOURCETABLE\\r\\n"
        )

        return (
            "HTTP/1.1 200 OK\\r\\n"
            "Server: simple-python-ntrip-caster-v2-svin\\r\\n"
            "Content-Type: text/plain\\r\\n"
            f"Content-Length: {len(body.encode('ascii'))}\\r\\n"
            "Connection: close\\r\\n"
            "\\r\\n"
            f"{body}"
        )

    def send_sourcetable(self, conn: socket.socket):
        conn.sendall(self.build_sourcetable().encode("ascii"))
        conn.close()

    def accept_rover_client(self, conn: socket.socket, addr, headers: dict):
        if self.send_http_200:
            response = (
                "HTTP/1.1 200 OK\r\n"
                "Server: simple-python-ntrip-caster-v2-svin\r\n"
                "Content-Type: gnss/data\r\n"
                "Connection: close\r\n"
                "\r\n"
            )
        else:
            # NTRIP v1 compatibility
            response = (
                "ICY 200 OK\r\n"
                "Server: simple-python-ntrip-caster-v2-svin\r\n"
                "Content-Type: gnss/data\r\n"
                "\r\n"
            )

        conn.sendall(response.encode("ascii"))
        conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

        user_agent = headers.get("user-agent", "")

        client = Client(
            conn=conn,
            addr=addr,
            user_agent=user_agent,
        )

        with self.clients_lock:
            self.clients.append(client)
            self.peak_clients = max(self.peak_clients, len(self.clients))

        print(f"[NTRIP CLIENT] Accepted /{self.mountpoint}: {addr}, UA='{user_agent}'")

        # Send cached base/station frames immediately.
        # This helps a rover that connects between 1005/1006 periods.
        try:
            for msg_type in sorted(self.station_cache.keys()):
                frame = self.station_cache[msg_type]
                conn.sendall(frame)
                client.bytes_sent += len(frame)
                client.frames_sent += 1
        except Exception:
            self.remove_client(client)

    def handle_client(self, conn: socket.socket, addr):
        print(f"[NTRIP CLIENT] Incoming: {addr}")

        try:
            request = self.read_http_request(conn)
            first_line, headers = self.parse_headers(request)

            print(f"[NTRIP CLIENT] Request: {first_line}")

            if not first_line:
                conn.close()
                return

            parts = first_line.split()
            method = parts[0] if len(parts) >= 1 else ""
            path = parts[1] if len(parts) >= 2 else "/"

            # Sourcetable request
            if method == "GET" and path in ("/", ""):
                self.send_sourcetable(conn)
                return

            expected_path = f"/{self.mountpoint}"

            if method == "GET" and path == expected_path:
                if not self.check_auth(headers):
                    print(f"[NTRIP CLIENT] Unauthorized: {addr}")
                    self.send_unauthorized(conn)
                    conn.close()
                    return

                self.accept_rover_client(conn, addr, headers)
                return

            self.send_not_found(conn)
            conn.close()
            print(f"[NTRIP CLIENT] Rejected path='{path}': {addr}")

        except Exception as e:
            print(f"[NTRIP CLIENT] Error {addr}: {e}")
            try:
                conn.close()
            except Exception:
                pass

    def accept_loop(self, server_sock: socket.socket):
        while self.running:
            try:
                conn, addr = server_sock.accept()
            except OSError:
                break

            t = threading.Thread(
                target=self.handle_client,
                args=(conn, addr),
                daemon=True,
            )
            t.start()

    def remove_client(self, client: Client):
        with self.clients_lock:
            if client in self.clients:
                self.clients.remove(client)

        try:
            client.conn.close()
        except Exception:
            pass

        age = time.time() - client.connected_at
        print(
            f"[NTRIP CLIENT] Disconnected {client.addr}, "
            f"age={age:.1f}s, "
            f"bytes={client.bytes_sent}, "
            f"frames={client.frames_sent}"
        )

    def broadcast_rtcm(self, frame: bytes) -> int:
        dead_clients = []
        sent_bytes = 0

        with self.clients_lock:
            current_clients = list(self.clients)

        for client in current_clients:
            try:
                client.conn.sendall(frame)
                client.bytes_sent += len(frame)
                client.frames_sent += 1
                self.total_client_bytes += len(frame)
                sent_bytes += len(frame)
            except Exception:
                dead_clients.append(client)

        for client in dead_clients:
            self.remove_client(client)

        return sent_bytes

    def top_messages(self, max_items=10) -> str:
        if not self.rtcm_msg_counter:
            return "none"
        return ", ".join(
            [f"{msg}:{count}" for msg, count in self.rtcm_msg_counter.most_common(max_items)]
        )

    def clients_summary(self) -> str:
        with self.clients_lock:
            if not self.clients:
                return "none"

            items = []
            for c in self.clients:
                age = time.time() - c.connected_at
                items.append(
                    f"{c.addr[0]}:{c.addr[1]} age={age:.0f}s bytes={c.bytes_sent}"
                )
            return " | ".join(items)

    def ensure_metrics_csv_header(self):
        if not self.metrics_csv:
            return

        parent = os.path.dirname(os.path.abspath(self.metrics_csv))
        if parent:
            os.makedirs(parent, exist_ok=True)

        need_header = (not os.path.exists(self.metrics_csv)) or os.path.getsize(self.metrics_csv) == 0
        if not need_header:
            return

        with open(self.metrics_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp",
                "uptime_min",
                "interval_s",
                "rtcm_frame_rate_fps",
                "valid_frames_interval",
                "parsed_frames_interval",
                "bad_crc_interval",
                "crc_error_percent_interval",
                "message_types_interval",
                "serial_input_Bps",
                "client_output_Bps",
                "client_count",
                "peak_client_count",
                "total_valid_frames",
                "total_bad_crc",
                "total_client_bytes",
                "station",
                "svin",
            ])

    def format_msg_counter(self, counter: Counter) -> str:
        if not counter:
            return "none"
        return ", ".join([f"{msg}:{count}" for msg, count in sorted(counter.items())])

    def write_metrics_csv(
        self,
        interval_s: float,
        interval_serial_bytes: int,
        interval_client_bytes: int,
        interval_frames: int,
        interval_valid_frames: int,
        interval_bad_crc: int,
        interval_msg_counter: Counter,
        n_clients: int,
    ):
        if not self.metrics_csv:
            return

        self.ensure_metrics_csv_header()

        uptime_min = (time.time() - self.start_time) / 60.0
        frame_rate = interval_valid_frames / max(interval_s, 0.001)
        crc_percent = (interval_bad_crc / max(interval_frames, 1)) * 100.0
        serial_bps = interval_serial_bytes / max(interval_s, 0.001)
        client_bps = interval_client_bytes / max(interval_s, 0.001)

        with open(self.metrics_csv, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                time.strftime("%Y-%m-%d %H:%M:%S"),
                f"{uptime_min:.3f}",
                f"{interval_s:.3f}",
                f"{frame_rate:.3f}",
                interval_valid_frames,
                interval_frames,
                interval_bad_crc,
                f"{crc_percent:.3f}",
                self.format_msg_counter(interval_msg_counter),
                f"{serial_bps:.1f}",
                f"{client_bps:.1f}",
                n_clients,
                self.peak_clients,
                self.total_valid_frames,
                self.total_bad_crc,
                self.total_client_bytes,
                self.station_summary(),
                self.svin_summary(),
            ])

    def print_report_table_line(
        self,
        interval_s: float,
        interval_serial_bytes: int,
        interval_client_bytes: int,
        interval_frames: int,
        interval_valid_frames: int,
        interval_bad_crc: int,
        interval_msg_counter: Counter,
        n_clients: int,
    ):
        uptime_min = (time.time() - self.start_time) / 60.0
        frame_rate = interval_valid_frames / max(interval_s, 0.001)
        crc_percent = (interval_bad_crc / max(interval_frames, 1)) * 100.0
        client_bps = interval_client_bytes / max(interval_s, 0.001)

        print(
            "[REPORT_TABLE] "
            f"rtcm_frame_rate={frame_rate:.2f} frame/s | "
            f"valid_frames={self.total_valid_frames} frame | "
            f"bad_crc={self.total_bad_crc} frame | "
            f"crc_error_rate={crc_percent:.2f}% | "
            f"message_types={self.format_msg_counter(interval_msg_counter)} | "
            f"rtcm_output={client_bps:.1f} byte/s | "
            f"clients={n_clients} client | "
            f"uptime={uptime_min:.2f} min"
        )

    def print_final_report(self):
        uptime_min = (time.time() - self.start_time) / 60.0
        total_crc_percent = (self.total_bad_crc / max(self.total_parsed_frames, 1)) * 100.0
        avg_frame_rate = self.total_valid_frames / max(time.time() - self.start_time, 0.001)
        avg_output_bps = self.total_client_bytes / max(time.time() - self.start_time, 0.001)

        print("\n================ NTRIP SERVER FINAL REPORT ================")
        print(f"1. Tan suat nhan frame RTCM3        : {avg_frame_rate:.2f} frame/s")
        print(f"2. So frame RTCM3 hop le            : {self.total_valid_frames} frame")
        print(f"3. So frame loi CRC24Q              : {self.total_bad_crc} frame")
        print(f"4. Ty le loi CRC24Q                 : {total_crc_percent:.2f} %")
        print(f"5. Cac message type nhan duoc       : {self.top_messages(20)}")
        print(f"6. Dung luong RTCM phat ra          : {avg_output_bps:.1f} byte/s")
        print(f"7. So client ket noi den server     : peak={self.peak_clients} client")
        print(f"8. Thoi gian server chay on dinh    : {uptime_min:.2f} phut")
        print("==========================================================\n")

    def run(self):
        print("[NTRIP CASTER] Opening serial...")
        ser = serial.Serial(
            port=self.serial_port,
            baudrate=self.baud,
            timeout=0.2,
        )

        print("[NTRIP CASTER] Opening TCP server...")
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_sock.bind((self.host, self.port))
        server_sock.listen(20)

        print(f"[NTRIP CASTER] Serial: {self.serial_port} @ {self.baud}")
        print(f"[NTRIP CASTER] Listening: {self.host}:{self.port}")
        print(f"[NTRIP CASTER] Mountpoint: /{self.mountpoint}")
        print(f"[NTRIP CASTER] Auth enabled: {self.auth_enabled}")
        print(f"[NTRIP CASTER] Response mode: {'HTTP/1.1 200 OK' if self.send_http_200 else 'ICY 200 OK'}")
        print("[NTRIP CASTER] Survey-In monitor: UBX-NAV-SVIN must be enabled on receiver output port")

        accept_thread = threading.Thread(
            target=self.accept_loop,
            args=(server_sock,),
            daemon=True,
        )
        accept_thread.start()

        interval_serial_bytes = 0
        interval_client_bytes = 0
        interval_frames = 0
        interval_valid_frames = 0
        interval_bad_crc = 0
        interval_msg_counter = Counter()
        self.ensure_metrics_csv_header()
        last_print = time.time()

        while self.running:
            try:
                data = ser.read(1024)
            except serial.SerialException as e:
                print(f"[NTRIP CASTER] Serial error: {e}")
                time.sleep(1.0)
                continue

            if data:
                self.total_serial_bytes += len(data)
                interval_serial_bytes += len(data)

                if self.debug_hex:
                    print("[HEX]", data[:self.max_hex_bytes].hex(" "))

                # Parse UBX-NAV-SVIN if receiver outputs it on the same serial port.
                # This does not affect RTCM streaming.
                self.parse_ubx_stream(data)

                frames, valid_frames = self.parse_rtcm_stream(data)

                interval_frames += len(frames)
                interval_valid_frames += len(valid_frames)
                interval_bad_crc += sum(1 for f in frames if not f["crc_ok"])
                interval_msg_counter.update(f["type"] for f in frames if f["crc_ok"])

                for frame in valid_frames:
                    interval_client_bytes += self.broadcast_rtcm(frame)

            now = time.time()
            if now - last_print >= self.log_interval:
                with self.clients_lock:
                    n_clients = len(self.clients)
                    self.peak_clients = max(self.peak_clients, n_clients)

                interval_s = now - last_print
                bps = interval_serial_bytes / max(interval_s, 0.001)
                client_bps = interval_client_bytes / max(interval_s, 0.001)
                age_rtcm = now - self.last_rtcm_time if self.last_rtcm_time > 0 else -1
                crc_percent = (interval_bad_crc / max(interval_frames, 1)) * 100.0
                fps = interval_valid_frames / max(interval_s, 0.001)

                print(
                    f"[NTRIP CASTER] "
                    f"in={int(bps)} B/s, "
                    f"out={int(client_bps)} B/s, "
                    f"fps={fps:.2f}, "
                    f"frames={interval_frames}, "
                    f"valid={interval_valid_frames}, "
                    f"bad_crc={interval_bad_crc}, "
                    f"crc_err={crc_percent:.2f}%, "
                    f"clients={n_clients}, "
                    f"uptime={(now - self.start_time) / 60.0:.2f}min, "
                    f"rtcm_age={age_rtcm:.1f}s, "
                    f"station={self.station_summary()}, "
                    f"svin={self.svin_summary()}, "
                    f"msg_interval={self.format_msg_counter(interval_msg_counter)}, "
                    f"top_msg_total={self.top_messages()}"
                )

                if n_clients > 0:
                    print(f"[NTRIP CLIENTS] {self.clients_summary()}")

                self.write_metrics_csv(
                    interval_s,
                    interval_serial_bytes,
                    interval_client_bytes,
                    interval_frames,
                    interval_valid_frames,
                    interval_bad_crc,
                    interval_msg_counter,
                    n_clients,
                )

                if now - self.last_report_table_time >= self.report_interval:
                    self.print_report_table_line(
                        interval_s,
                        interval_serial_bytes,
                        interval_client_bytes,
                        interval_frames,
                        interval_valid_frames,
                        interval_bad_crc,
                        interval_msg_counter,
                        n_clients,
                    )
                    self.last_report_table_time = now

                interval_serial_bytes = 0
                interval_client_bytes = 0
                interval_frames = 0
                interval_valid_frames = 0
                interval_bad_crc = 0
                interval_msg_counter = Counter()
                last_print = now

        try:
            server_sock.close()
        except Exception:
            pass

        try:
            ser.close()
        except Exception:
            pass

        self.print_final_report()


def main():
    parser = argparse.ArgumentParser(
        description="Simple NTRIP caster for ZED-F9P RTCM3 serial stream with UBX-NAV-SVIN Survey-In monitor"
    )

    parser.add_argument("--serial", default="/dev/ttyACM0")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=2101)
    parser.add_argument("--mountpoint", default="BASE")

    parser.add_argument("--username", default=None)
    parser.add_argument("--password", default=None)

    parser.add_argument(
        "--http-200",
        action="store_true",
        help="Use HTTP/1.1 200 OK instead of ICY 200 OK"
    )

    parser.add_argument("--debug-rtcm", action="store_true")
    parser.add_argument("--debug-hex", action="store_true")
    parser.add_argument("--max-hex-bytes", type=int, default=64)
    parser.add_argument("--log-interval", type=float, default=1.0)

    parser.add_argument("--source-name", default="ZED-F9P_BASE")
    parser.add_argument("--country", default="VNM")
    parser.add_argument("--latitude", type=float, default=0.0)
    parser.add_argument("--longitude", type=float, default=0.0)

    parser.add_argument(
        "--metrics-csv",
        default="ntrip_server_metrics.csv",
        help="CSV file used to log measurements for the NTRIP Server evaluation table"
    )
    parser.add_argument(
        "--report-interval",
        type=float,
        default=10.0,
        help="Seconds between copy-ready [REPORT_TABLE] lines"
    )

    args = parser.parse_args()

    caster = NtripCaster(
        serial_port=args.serial,
        baud=args.baud,
        host=args.host,
        port=args.port,
        mountpoint=args.mountpoint,
        username=args.username,
        password=args.password,
        send_http_200=args.http_200,
        debug_rtcm=args.debug_rtcm,
        debug_hex=args.debug_hex,
        max_hex_bytes=args.max_hex_bytes,
        log_interval=args.log_interval,
        source_name=args.source_name,
        country=args.country,
        latitude=args.latitude,
        longitude=args.longitude,
        metrics_csv=args.metrics_csv,
        report_interval=args.report_interval,
    )

    def handle_sigint(signum, frame):
        print("\n[NTRIP CASTER] Stopping...")
        caster.running = False

    signal.signal(signal.SIGINT, handle_sigint)
    signal.signal(signal.SIGTERM, handle_sigint)

    caster.run()


if __name__ == "__main__":
    main()