import textwrap
import svgwrite
import cairosvg
from pathlib import Path

W, H = 6400, 4200
OUT_SVG = Path('/mnt/data/ntrip_architecture_large.svg')
OUT_PNG = Path('/mnt/data/ntrip_architecture_large.png')

# Five main colors + neutrals
BLUE = '#2563EB'; BLUE_BG = '#EFF6FF'; BLUE_HEAD = '#DBEAFE'
ORANGE = '#D97706'; ORANGE_BG = '#FFFBEB'; ORANGE_HEAD = '#FEF3C7'
GREEN = '#15803D'; GREEN_BG = '#F0FDF4'; GREEN_HEAD = '#DCFCE7'
PURPLE = '#7C3AED'; PURPLE_BG = '#FAF5FF'; PURPLE_HEAD = '#EDE9FE'
RED = '#DC2626'; RED_BG = '#FEF2F2'; RED_HEAD = '#FEE2E2'
INK = '#0F172A'; MUTED = '#475569'; LIGHT = '#F8FAFC'; WHITE = '#FFFFFF'
FONT = 'DejaVu Sans'

svg = svgwrite.Drawing(str(OUT_SVG), size=(W, H), viewBox=f'0 0 {W} {H}')
svg.add(svg.rect(insert=(0, 0), size=(W, H), fill=WHITE))

# Arrow markers
for name, color in [('blue', BLUE), ('orange', ORANGE), ('green', GREEN),
                    ('purple', PURPLE), ('red', RED), ('gray', MUTED)]:
    marker = svg.marker(id=f'arrow-{name}', insert=(10, 5), size=(11, 11), orient='auto', markerUnits='strokeWidth')
    marker.add(svg.path(d='M 0 0 L 10 5 L 0 10 z', fill=color))
    svg.defs.add(marker)


def text(x, y, value, size=20, weight='normal', fill=INK, anchor='start'):
    node = svg.text(value, insert=(x, y), font_family=FONT, font_size=size,
                    font_weight=weight, fill=fill, text_anchor=anchor)
    svg.add(node)
    return node


def multiline(x, y, lines, size=18, line_h=25, fill=INK, weight='normal', anchor='start'):
    node = svg.text('', insert=(x, y), font_family=FONT, font_size=size,
                    font_weight=weight, fill=fill, text_anchor=anchor)
    for i, line in enumerate(lines):
        node.add(svg.tspan(line, x=[x], dy=[0 if i == 0 else line_h]))
    svg.add(node)
    return node


def wrap(value, width):
    return textwrap.wrap(value, width=width, break_long_words=False, break_on_hyphens=False) or ['']


def section(x, y, w, h, title_value, color, bg, number=None, title_size=28):
    svg.add(svg.rect(insert=(x, y), size=(w, h), rx=24, ry=24,
                     fill=bg, stroke=color, stroke_width=2.5))
    if number is not None:
        svg.add(svg.circle(center=(x + 40, y + 38), r=23, fill=color))
        text(x + 40, y + 46, str(number), size=22, weight='bold', fill=WHITE, anchor='middle')
        text(x + 78, y + 48, title_value, size=title_size, weight='bold')
    else:
        text(x + 24, y + 46, title_value, size=title_size, weight='bold')


def box(x, y, w, h, title_value, items, color, head_bg,
        title_size=21, body_size=17, chars=None, header_h=56, bullet=True):
    # Safely wrap long titles inside the header.
    title_chars = max(14, int(w / (title_size * 0.62)))
    title_lines = wrap(title_value, title_chars)
    if len(title_lines) > 1:
        header_h = max(header_h, 78)
    svg.add(svg.rect(insert=(x, y), size=(w, h), rx=17, ry=17,
                     fill=WHITE, stroke=color, stroke_width=2.0))
    svg.add(svg.rect(insert=(x, y), size=(w, header_h), rx=17, ry=17,
                     fill=head_bg, stroke='none'))
    svg.add(svg.rect(insert=(x, y + header_h - 14), size=(w, 14), fill=head_bg, stroke='none'))
    title_y = y + 34 if len(title_lines) == 1 else y + 28
    multiline(x + w/2, title_y, title_lines[:2], size=title_size,
              line_h=24, weight='bold', anchor='middle')

    yy = y + header_h + 28
    max_chars = chars or max(24, int(w / (body_size * 0.60)))
    for item in items:
        prefix = '• ' if bullet else ''
        for line in wrap(prefix + item, max_chars):
            text(x + 18, yy, line, size=body_size)
            yy += body_size + 7
        yy += 4
    return (x, y, w, h)


def arrow_name(color):
    return {BLUE: 'blue', ORANGE: 'orange', GREEN: 'green', PURPLE: 'purple', RED: 'red', MUTED: 'gray'}.get(color, 'gray')


def route(points, color=MUTED, width=3.2, dashed=False, arrow=True, opacity=1.0):
    d = 'M ' + ' L '.join(f'{x},{y}' for x, y in points)
    node = svg.path(d=d, fill='none', stroke=color, stroke_width=width,
                    stroke_linejoin='round', stroke_linecap='round', opacity=opacity)
    if dashed:
        node['stroke-dasharray'] = '12,9'
    if arrow:
        node['marker-end'] = f'url(#arrow-{arrow_name(color)})'
    svg.add(node)
    return node


def flow_badge(x, y, number, color):
    svg.add(svg.circle(center=(x, y), r=18, fill=color, stroke=WHITE, stroke_width=3))
    text(x, y + 7, str(number), size=17, weight='bold', fill=WHITE, anchor='middle')


# ========================= TITLE =========================
text(W/2, 58, 'KIẾN TRÚC TỔNG THỂ & LUỒNG XỬ LÝ END-TO-END HỆ THỐNG NTRIP CASTER',
     size=39, weight='bold', anchor='middle')
text(W/2, 96, 'Bản khổ lớn — ưu tiên không chồng chữ, không chồng viền và đường nối đi theo hành lang riêng',
     size=20, fill=MUTED, anchor='middle')

# ========================= 1. DEVICES =========================
section(45, 125, 6310, 440, 'THIẾT BỊ, GIAO DIỆN VÀ ĐẦU VÀO / ĐẦU RA', BLUE, BLUE_BG, 1)

box(110, 205, 420, 220, 'GNSS / RTK BASE', [
    'Sinh dữ liệu hiệu chỉnh RTCM3',
    'Gửi luồng nhị phân RTCM qua UART'
], BLUE, BLUE_HEAD, body_size=18, chars=34)

box(650, 170, 1060, 305, 'ESP32 BASE STATION GATEWAY', [
    'IN: RTCM3 UART và runtime config từ Web API',
    'RtkUart → GnssParser: tách frame, kiểm tra CRC24Q, đọc UBX NAV-SVIN',
    'NtripSource: kết nối TCP và đẩy RTCM tới mountpoint của Caster',
    'TelemetryHttpClient: gửi trạng thái trạm; ConfigHttpClient: lấy cấu hình mới',
    'OUT: RTCM Source stream + telemetry JSON'
], BLUE, BLUE_HEAD, body_size=17, chars=78)

box(2120, 170, 990, 305, 'WEB DASHBOARD', [
    'React + Inertia + MapLibre',
    'OUT: CRUD trạm, mountpoint, rover account, acknowledge alert, request snapshot',
    'IN: JSON API + WebSocket realtime',
    'Hiển thị Stations, Mountpoints, RTCM, Sessions, Bell notification'
], BLUE, BLUE_HEAD, body_size=17, chars=68)

box(3520, 170, 1160, 305, 'RASPBERRY PI — NTRIP ROVER TRÊN DRONE', [
    'NTRIPClient → RTCMParser → MAVLinkBridge',
    'IN: RTCM3 từ Caster + GLOBAL_POSITION_INT từ PX4',
    'OUT: MAVLink GPS_RTCM_DATA tới PX4 + GGA gửi ngược về Caster',
    'Ghi metrics tốc độ nhận, số frame, CRC error và truyền MAVLink'
], BLUE, BLUE_HEAD, body_size=17, chars=78)

box(5100, 205, 1050, 220, 'PX4 FLIGHT CONTROLLER', [
    'IN: MAVLink GPS_RTCM_DATA',
    'GNSS driver sử dụng RTCM để đạt RTK Float / Fix',
    'OUT: GLOBAL_POSITION_INT cho Raspberry Pi'
], BLUE, BLUE_HEAD, body_size=18, chars=66)

route([(530, 315), (650, 315)], BLUE, 4.3); flow_badge(590, 288, 1, BLUE)
route([(4680, 285), (5100, 285)], BLUE, 4.3); flow_badge(4890, 258, 2, BLUE)
route([(5100, 375), (4880, 375), (4880, 430), (4680, 430)], BLUE, 3.5, dashed=True); flow_badge(4890, 403, 3, BLUE)

# ========================= 2. ENTRY / ROUTING =========================
section(45, 610, 6310, 460, 'SERVER RUNTIME, ROUTE, MIDDLEWARE VÀ PHÂN LUỒNG', ORANGE, ORANGE_BG, 2)

box(120, 685, 1480, 275, 'NTRIP TCP SERVER :2101', [
    'php artisan ntrip:serve → NtripServeCommand',
    'POST /{mountpoint}: NTRIP Source v2 + Bearer source token',
    'SOURCE password /{mountpoint}: hỗ trợ NTRIP Source v1',
    'GET /{mountpoint}: NTRIP Rover + Basic username/password + GGA',
    'GET /: trả Sourcetable'
], ORANGE, ORANGE_HEAD, body_size=18, chars=96)

box(1750, 660, 2350, 325, 'LARAVEL WEB / API SERVER :8000', [
    'public/index.php → bootstrap/app.php',
    'web.php: Dashboard, Stations, Mountpoints, RTCM Live, Sessions, Settings',
    'api.php: Station, Station Config, Telemetry, Mountpoint, NTRIP Session, Rover Account, Dashboard Snapshot, Alert, System Status',
    'Middleware: web session + CSRF, auth, verified, auth:sanctum, statefulApi, route binding và validation',
    'OUT: Inertia pages hoặc JSON response'
], ORANGE, ORANGE_HEAD, body_size=18, chars=126)

box(4250, 685, 950, 275, 'LARAVEL REVERB :8080', [
    'WebSocket server',
    'channels.php + broadcast authentication',
    'Private channel: ntrip.dashboard',
    'OUT: realtime events tới Dashboard / Bell'
], ORANGE, ORANGE_HEAD, body_size=18, chars=55)

box(5350, 685, 880, 275, 'SCHEDULER RUNTIME', [
    'php artisan schedule:work',
    'console.php dispatch EvaluateAlerts',
    'Chu kỳ 5 giây khi alerts.enabled=true'
], ORANGE, ORANGE_HEAD, body_size=18, chars=52)

# External flows use dedicated corridor between sections.
route([(1180, 475), (1180, 585), (860, 585), (860, 685)], BLUE, 4.0); flow_badge(1140, 582, 4, BLUE)
route([(4100, 475), (4100, 590), (1330, 590), (1330, 685)], BLUE, 4.0); flow_badge(4035, 587, 5, BLUE)
route([(1180, 475), (1180, 570), (2925, 570), (2925, 660)], ORANGE, 3.4, dashed=True); flow_badge(2050, 567, 6, ORANGE)
route([(2615, 475), (2615, 660)], ORANGE, 3.4, dashed=True); flow_badge(2580, 575, 7, ORANGE)
route([(2615, 475), (2615, 550), (4725, 550), (4725, 685)], PURPLE, 3.4, dashed=True); flow_badge(3900, 547, 8, PURPLE)

# ========================= 3. BACKEND LOGIC =========================
section(45, 1115, 6310, 2025, 'LOGIC BACKEND — CONTROLLERS, SERVICES VÀ LUỒNG XỬ LÝ', GREEN, GREEN_BG, 3)
section(75, 1190, 1450, 1840, 'A. NTRIP STREAMING & SESSION LIFECYCLE', GREEN, '#ECFDF5', title_size=24)
section(1575, 1190, 3130, 1840, 'B. HTTP MANAGEMENT API — CONTROLLERS & SERVICE', GREEN, '#ECFDF5', title_size=24)
section(4755, 1190, 1570, 1840, 'C. ALERT ENGINE & AUTOMATION', GREEN, '#ECFDF5', title_size=24)

# --- A: NTRIP streaming ---
box(120, 1260, 510, 145, 'NtripServeCommand', [
    'Khởi tạo NtripCaster',
    'Giữ process TCP chạy liên tục'
], GREEN, GREEN_HEAD, body_size=17, chars=38)

box(700, 1240, 770, 260, 'NtripCaster', [
    'IN: Source/Rover handshake, RTCM stream và GGA',
    'stream_socket_server + stream_select non-blocking',
    'Quản lý client buffer, timeout, mountpoint và source hiện hành',
    'Relay RTCM Source → mọi Rover cùng mountpoint',
    'OUT: RTCM downlink + thay đổi session/statistics'
], GREEN, GREEN_HEAD, body_size=17, chars=68)

box(120, 1580, 380, 175, 'NtripBasicAuthorization', [
    'Giải mã Authorization: Basic',
    'OUT: username + password'
], GREEN, GREEN_HEAD, body_size=16, chars=34)

box(535, 1560, 455, 245, 'RoverAuthenticationService', [
    'Kiểm tra mountpoint và station enabled',
    'Kiểm tra public/private, account và password',
    'Kiểm tra quyền mountpoint và giới hạn kết nối',
    'OUT: RoverAuthenticationResult'
], GREEN, GREEN_HEAD, body_size=16, chars=42)

box(1025, 1560, 445, 245, 'RoverConnectionService', [
    'Nhận request, IP và user-agent',
    'Gọi RoverAuthenticationService',
    'Tạo Rover session khi hợp lệ',
    'OUT: RoverConnectionResult'
], GREEN, GREEN_HEAD, body_size=16, chars=42)

box(185, 1940, 500, 230, 'Rtcm3Parser', [
    'Tách RTCM frame theo preamble 0xD3',
    'Kiểm tra CRC24Q và đọc message type',
    'Đếm valid frames, CRC errors, bytes và rate',
    'OUT: RTCM statistics'
], GREEN, GREEN_HEAD, body_size=16, chars=46)

box(780, 1905, 690, 300, 'NtripSessionService', [
    'createSourceSession / createRoverSession',
    'updateStats / updateLifecycle / endSession / endAllActive',
    'Lưu source/rover, station, mountpoint, IP, bytes, bitrate và RTCM stats',
    'OUT: session database state + NtripSession Events'
], GREEN, GREEN_HEAD, body_size=16, chars=64)

route([(630, 1332), (700, 1332)], GREEN, 3.2)
route([(1085, 1500), (1085, 1530), (1247, 1530), (1247, 1560)], GREEN, 3.0)
route([(1025, 1680), (990, 1680)], GREEN, 3.0)
route([(535, 1680), (500, 1680)], GREEN, 3.0)
route([(310, 1755), (310, 1870), (435, 1870), (435, 1940)], GREEN, 3.0)
route([(1247, 1805), (1247, 1905)], GREEN, 3.0)
route([(1085, 1500), (1085, 1850), (1125, 1850), (1125, 1905)], GREEN, 3.0)
route([(685, 2055), (780, 2055)], GREEN, 3.0)

# --- B: HTTP API controllers ---
box(1950, 1245, 2350, 135, 'API ROUTER / CONTROLLER DISPATCH', [
    'Request đã qua middleware được chuyển tới đúng Controller; Controller điều phối query, transaction, Service và response'
], GREEN, GREEN_HEAD, body_size=18, chars=130)

COL_W = 690; GAP = 55
COL_X = [1635 + i * (COL_W + GAP) for i in range(4)]
ROW_Y = [1460, 1785, 2110]
CTRL_H = 265

controllers = [
    (COL_X[0], ROW_Y[0], 'StationController', [
        'IN: CRUD Station từ Dashboard',
        'store(): transaction tạo Station + StationConfig + Mountpoint',
        'Hash source token; bật/tắt và cập nhật station',
        'OUT: station JSON'
    ]),
    (COL_X[1], ROW_Y[0], 'StationConfigController', [
        'GET /stations/{deviceId}/config?revision=',
        'PUT config và các giá trị mountpoint liên quan',
        'Tăng revision để ESP32 nhận thay đổi',
        'OUT: runtime config JSON hoặc 204'
    ]),
    (COL_X[2], ROW_Y[0], 'StationTelemetryController', [
        'IN: telemetry JSON từ ESP32',
        'Verify X-Station-Token',
        'Update last_seen, IP, source_connected; upsert latest telemetry',
        'OUT: HTTP 202 + StationTelemetryUpdated'
    ]),
    (COL_X[3], ROW_Y[0], 'MountpointController', [
        'List, show và update mountpoint',
        'Quản lý enabled, access_mode và max_connections',
        'Đọc trạng thái source/session liên quan',
        'OUT: mountpoint JSON'
    ]),
    (COL_X[0], ROW_Y[1], 'NtripSessionController', [
        'List active hoặc history',
        'Filter type, status, station và mountpoint',
        'Pagination và thống kê session',
        'OUT: session JSON'
    ]),
    (COL_X[1], ROW_Y[1], 'RoverAccountController', [
        'CRUD tài khoản Rover',
        'Hash password; enable/disable',
        'Thiết lập giới hạn kết nối',
        'OUT: RoverAccountResource'
    ]),
    (COL_X[2], ROW_Y[1], 'RoverAccountMountpointController', [
        'Đọc quyền mountpoint của Rover Account',
        'Sync bảng pivot trong database transaction',
        'Áp dụng allowed / denied access',
        'OUT: MountpointAccessResource'
    ]),
    (COL_X[3], ROW_Y[1], 'DashboardSnapshotController', [
        'IN: GET /dashboard/snapshot',
        'Gọi DashboardSnapshotService',
        'Không tự tổng hợp dữ liệu trong Controller',
        'OUT: versioned snapshot JSON'
    ]),
    (COL_X[0], ROW_Y[2], 'AlertController', [
        'List/filter active và history; summary',
        'Acknowledge alert của người vận hành',
        'Query Alert hoặc gọi AlertService',
        'OUT: AlertResource'
    ]),
    (COL_X[1], ROW_Y[2], 'SystemStatusController', [
        'Tổng hợp trạng thái server và Caster',
        'Đếm stations, mountpoints, sources và rovers',
        'Tổng hợp traffic và thời điểm kiểm tra',
        'OUT: system status JSON'
    ]),
]

for x, y, title_value, items in controllers:
    box(x, y, COL_W, CTRL_H, title_value, items, GREEN, GREEN_HEAD,
        title_size=20, body_size=16, chars=59)

# Dashboard service occupies two controller columns, with generous width.
box(COL_X[2], ROW_Y[2], COL_W * 2 + GAP, CTRL_H, 'DashboardSnapshotService', [
    'Đọc Stations + latest telemetry + Mountpoints + active NTRIP sessions',
    'Tính station health, source/rover counts, traffic, RTCM age và CRC',
    'Chuẩn hóa dữ liệu để Dashboard có một snapshot nhất quán',
    'OUT: versioned dashboard snapshot'
], GREEN, GREEN_HEAD, title_size=21, body_size=16, chars=125)

# Routing buses in dedicated empty gutters; none pass through boxes.
# Row 1 bus
route([(3125, 1380), (3125, 1425), (1980, 1425)], GREEN, 3.0, arrow=False)
route([(3125, 1425), (4235, 1425)], GREEN, 3.0, arrow=False)
for x in COL_X:
    route([(x + COL_W/2, 1425), (x + COL_W/2, ROW_Y[0])], GREEN, 2.6)
# Row 2 bus along right outer corridor
route([(4300, 1312), (4660, 1312), (4660, 1750), (1980, 1750)], GREEN, 2.8, arrow=False)
for x in COL_X:
    route([(x + COL_W/2, 1750), (x + COL_W/2, ROW_Y[1])], GREEN, 2.5)
# Row 3 bus along left outer corridor
route([(1950, 1312), (1605, 1312), (1605, 2075), (1980, 2075)], GREEN, 2.8, arrow=False)
route([(1980, 2075), (4235, 2075)], GREEN, 2.8, arrow=False)
for x in COL_X:
    route([(x + COL_W/2, 2075), (x + COL_W/2, ROW_Y[2])], GREEN, 2.5)

# --- C: Alert engine ---
box(5005, 1260, 1070, 175, 'EvaluateAlerts Job', [
    'Queue: alerts; unique trong 30 giây',
    'IN: scheduler tick',
    'Gọi AlertRuleEvaluator::evaluateAll()'
], GREEN, GREEN_HEAD, body_size=17, chars=72)

box(4930, 1540, 1220, 390, 'AlertRuleEvaluator', [
    'IN: Station + latest telemetry + active sessions + AlertRuleState',
    'STATION_OFFLINE: không nhận telemetry quá ngưỡng',
    'SOURCE_DISCONNECTED: station online nhưng source mất',
    'RTCM_STREAM_STALLED: source còn kết nối nhưng RTCM dừng hoặc quá cũ',
    'RTCM_CRC_ERRORS: CRC counter xuất hiện delta lỗi mới',
    'Áp dụng debounce, recovery delay và ưu tiên nguyên nhân',
    'OUT: yêu cầu open, touch hoặc resolve alert'
], GREEN, GREEN_HEAD, body_size=17, chars=82)

box(4930, 2040, 1220, 360, 'AlertService', [
    'openOrTouch / acknowledge / resolve / resolveByFingerprint',
    'Transaction + lockForUpdate để tránh race condition',
    'fingerprint + active_key chống alert active trùng nhau',
    'Cập nhật occurrence_count, timestamps, metadata và người xử lý',
    'OUT: Alert database state + Alert Events sau khi commit'
], GREEN, GREEN_HEAD, body_size=17, chars=82)

route([(5540, 1435), (5540, 1540)], GREEN, 3.3)
route([(5540, 1930), (5540, 2040)], GREEN, 3.3)

# Runtime entries to main logic, routed through the section gap.
route([(860, 960), (860, 1090), (375, 1090), (375, 1260)], ORANGE, 4.0); flow_badge(820, 1087, 9, ORANGE)
route([(2925, 985), (2925, 1095), (3125, 1095), (3125, 1245)], ORANGE, 4.0); flow_badge(2890, 1092, 10, ORANGE)

# End-to-end outputs returning to device layer through outer corridors.
route([(1085, 1240), (1085, 1080), (4020, 1080), (4020, 475)], BLUE, 3.5, dashed=True); flow_badge(3900, 1077, 11, BLUE)
route([(2755, 1460), (2755, 1405), (1545, 1405), (1545, 1090), (1180, 1090), (1180, 475)], ORANGE, 3.2, dashed=True); flow_badge(1510, 1235, 12, ORANGE)
route([(3890, 2110), (3890, 2075), (4725, 2075), (4725, 1085), (2615, 1085), (2615, 475)], ORANGE, 3.2, dashed=True); flow_badge(4690, 1510, 13, ORANGE)

# ========================= 4. EVENTS / REALTIME =========================
section(45, 3180, 6310, 455, 'DOMAIN EVENTS, DATABASE QUEUE VÀ REALTIME BROADCAST', PURPLE, PURPLE_BG, 4)

box(140, 3260, 920, 190, 'NtripSession Events', [
    'NtripSessionStarted',
    'NtripSessionUpdated',
    'NtripSessionEnded'
], PURPLE, PURPLE_HEAD, body_size=17, chars=60)

box(1190, 3260, 920, 190, 'StationTelemetryUpdated', [
    'Phát sau khi telemetry đã được lưu',
    'Payload dùng cập nhật station realtime'
], PURPLE, PURPLE_HEAD, body_size=17, chars=60)

box(2240, 3260, 920, 190, 'Alert Events', [
    'AlertOpened / AlertUpdated',
    'AlertAcknowledged / AlertResolved'
], PURPLE, PURPLE_HEAD, body_size=17, chars=60)

box(3390, 3260, 940, 190, 'DATABASE QUEUE', [
    'Queue default: broadcast jobs',
    'Queue alerts: EvaluateAlerts',
    'Bảng jobs / job_batches / failed_jobs'
], PURPLE, PURPLE_HEAD, body_size=17, chars=62)

box(4560, 3260, 850, 190, 'QUEUE WORKER', [
    'php artisan queue:listen',
    'Xử lý EvaluateAlerts và broadcast jobs'
], PURPLE, PURPLE_HEAD, body_size=17, chars=56)

box(5570, 3260, 650, 190, 'BROADCASTER', [
    'Laravel Reverb',
    'Publish private-ntrip.dashboard'
], PURPLE, PURPLE_HEAD, body_size=17, chars=42)

# Producer lines use separate vertical corridors and enter event boxes from top.
route([(1125, 2205), (1125, 3135), (600, 3135), (600, 3260)], PURPLE, 3.0)
route([(3495, 1725), (3495, 1750), (1545, 1750), (1545, 3110), (1650, 3110), (1650, 3260)], PURPLE, 3.0)
route([(5540, 2400), (5540, 3085), (2700, 3085), (2700, 3260)], PURPLE, 3.0)

# Events merge into queue in the lower gutter of section 4.
for center in [600, 1650, 2700]:
    route([(center, 3450), (center, 3510), (3860, 3510)], PURPLE, 2.8, arrow=False)
route([(3860, 3510), (3860, 3450)], PURPLE, 3.1)
route([(4330, 3355), (4560, 3355)], PURPLE, 3.1)
route([(5410, 3355), (5570, 3355)], PURPLE, 3.1)

# Scheduler -> queue -> worker -> job, all along the far-right reserved corridor.
route([(5790, 960), (5790, 3160), (3860, 3160), (3860, 3260)], PURPLE, 3.1, dashed=True); flow_badge(5755, 1550, 14, PURPLE)
route([(4985, 3260), (4985, 3050), (6225, 3050), (6225, 1210), (5540, 1210), (5540, 1260)], PURPLE, 3.1, dashed=True); flow_badge(6190, 2100, 15, PURPLE)
# Reverb output to dashboard via far-right/top corridor.
route([(5895, 3260), (6290, 3260), (6290, 590), (2615, 590), (2615, 475)], PURPLE, 3.3, dashed=True); flow_badge(6255, 890, 16, PURPLE)

# ========================= 5. ORM / DATABASE =========================
section(45, 3675, 6310, 370, 'DATA ACCESS VÀ DATABASE', RED, RED_BG, 5)

box(190, 3750, 3900, 220, 'ELOQUENT ORM / DATA ACCESS', [
    'Models: User, Station, StationConfig, Mountpoint, StationTelemetry, NtripSession, RoverAccount, MountpointRoverAccount, Alert, AlertRuleState',
    'Relationships, scopes, casts, route-model binding và database transactions',
    'API Resources: RoverAccountResource, MountpointAccessResource, AlertResource',
    'Nhận query/transaction từ NtripCaster, Controllers, DashboardSnapshotService và Alert Engine'
], RED, RED_HEAD, body_size=18, chars=180)

box(4350, 3750, 1840, 220, 'SQLITE DATABASE', [
    'NTRIP: stations, station_configs, mountpoints, station_telemetries, ntrip_sessions, rover_accounts, mountpoint_rover_account, alerts, alert_rule_states',
    'Auth: users, password_reset_tokens, sessions, passkeys, personal_access_tokens',
    'Framework: cache, cache_locks, jobs, job_batches, failed_jobs, migrations'
], RED, RED_HEAD, body_size=17, chars=105)

route([(4090, 3860), (4350, 3860)], RED, 4.0)

# Only three clean access lines from the three logic lanes.
route([(800, 3030), (800, 3650), (1200, 3650), (1200, 3750)], RED, 3.0)
route([(3125, 3030), (3125, 3750)], RED, 3.0)
route([(5540, 2400), (5540, 3650), (3600, 3650), (3600, 3750)], RED, 3.0)
# Database queue tables stored in same SQLite database.
route([(3860, 3450), (3860, 3625), (5350, 3625), (5350, 3750)], RED, 2.8, dashed=True)

# ========================= LEGEND =========================
section(45, 4070, 6310, 100, 'CHÚ THÍCH LUỒNG', MUTED, WHITE, title_size=22)
legend = [
    '① RTCM UART: Base → ESP32    ② RTCM MAVLink: Pi → PX4    ③ Position: PX4 → Pi    ④ RTCM Source: ESP32 → Caster',
    '⑤ RTCM Rover/GGA: Pi ↔ Caster    ⑥ Telemetry/Config: ESP32 ↔ API    ⑦ Dashboard ↔ API    ⑧ Dashboard ↔ Reverb',
    '⑨ NTRIP Entry → NtripCaster    ⑩ HTTP Entry → Controllers    ⑪ Caster → Pi    ⑫ Config response → ESP32',
    '⑬ Snapshot response → Dashboard    ⑭ Scheduler → Queue    ⑮ Worker → EvaluateAlerts    ⑯ Reverb → Dashboard/Bell'
]
multiline(85, 4115, legend, size=15, line_h=20)

# Compact five-color legend in top-right blank area.
legend_x, legend_y = 5200, 135
for i, (label, color) in enumerate([
    ('Thiết bị / RTCM', BLUE), ('HTTP / Routing', ORANGE), ('Logic xử lý', GREEN),
    ('Event / Realtime', PURPLE), ('Database', RED)
]):
    yy = legend_y + i * 28
    svg.add(svg.line(start=(legend_x, yy), end=(legend_x + 65, yy), stroke=color, stroke_width=6))
    text(legend_x + 80, yy + 7, label, size=16)

svg.save()
cairosvg.svg2png(url=str(OUT_SVG), write_to=str(OUT_PNG), output_width=W, output_height=H)
print(OUT_SVG)
print(OUT_PNG)
