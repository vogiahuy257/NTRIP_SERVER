################################################################################
# NTRIP Bridge - standalone C++ daemon for Raspberry Pi 5 / PX4
#
# Connects to an NTRIP caster, pulls RTCM3 correction streams and forwards
# them to a PX4 flight controller as MAVLink GPS_RTCM_DATA messages.
#
# Build:   cmake -S . -B build && cmake --build build -j$(nproc)
# Install: sudo cmake --install build
################################################################################

cmake_minimum_required(VERSION 3.16)
project(ntrip_bridge
    VERSION 1.0.0
    DESCRIPTION "NTRIP RTCM bridge for PX4 via MAVLink"
    LANGUAGES C CXX
)

#------------------------------------------------------------------------------
# Global build settings
#------------------------------------------------------------------------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

# Sensible warning set. MAVLink headers are noisy under -Wpedantic, so we
# apply warnings only to our own target (added further down).
set(NTRIP_BRIDGE_WARNINGS -Wall -Wextra -Wpedantic)

#------------------------------------------------------------------------------
# Dependency: MAVLink v2 C headers (header-only, fetched at configure time)
#
# The upstream repo (mavlink/c_library_v2) stores its dialect directories
# (common/, minimal/, standard/, ...) at the repo root. Our source code uses
# the convention `#include <mavlink/common/mavlink.h>`, so we stage the
# headers into `${CMAKE_BINARY_DIR}/mavlink_include/mavlink/` at configure
# time and point the include search path there.
#------------------------------------------------------------------------------
include(FetchContent)

FetchContent_Declare(
    mavlink_headers
    GIT_REPOSITORY https://github.com/mavlink/c_library_v2.git
    GIT_TAG        master
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(mavlink_headers)

set(MAVLINK_STAGED_INCLUDE_DIR "${CMAKE_BINARY_DIR}/mavlink_include")
file(MAKE_DIRECTORY "${MAVLINK_STAGED_INCLUDE_DIR}/mavlink")

# Copy headers under a mavlink/ prefix so `<mavlink/common/mavlink.h>` works.
# file(COPY) runs at configure time and is idempotent: subsequent configures
# only re-copy newer sources.
file(COPY "${mavlink_headers_SOURCE_DIR}/"
     DESTINATION "${MAVLINK_STAGED_INCLUDE_DIR}/mavlink"
)

#------------------------------------------------------------------------------
# Dependency: pthread
#------------------------------------------------------------------------------
set(THREADS_PREFER_PTHREAD_FLAG ON)
find_package(Threads REQUIRED)

#------------------------------------------------------------------------------
# Target: ntrip_bridge
#------------------------------------------------------------------------------
add_executable(ntrip_bridge
    ntrip.cc
    bridge_metrics.c
)

target_include_directories(ntrip_bridge PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${MAVLINK_STAGED_INCLUDE_DIR}
)

target_compile_options(ntrip_bridge PRIVATE ${NTRIP_BRIDGE_WARNINGS})

target_link_libraries(ntrip_bridge PRIVATE
    Threads::Threads
)

#------------------------------------------------------------------------------
# Generate systemd unit and example config inline (no extra source files
# required in the tree).
#------------------------------------------------------------------------------
set(NTRIP_BRIDGE_INSTALL_BIN "/usr/local/bin/ntrip_bridge")
set(NTRIP_BRIDGE_CONFIG_DIR  "/etc/ntrip-bridge")
set(NTRIP_BRIDGE_CONFIG_PATH "${NTRIP_BRIDGE_CONFIG_DIR}/config.conf")

file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/ntrip-bridge.service"
"[Unit]
Description=NTRIP RTCM Bridge for PX4
Documentation=https://github.com/mavlink/c_library_v2
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${NTRIP_BRIDGE_INSTALL_BIN} --config ${NTRIP_BRIDGE_CONFIG_PATH}
Restart=on-failure
RestartSec=5
User=root
StandardOutput=journal
StandardError=journal

# Basic hardening (relax if you need broader device access).
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
")

file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/config.conf.example"
"# ----------------------------------------------------------------------------
# NTRIP Bridge configuration
#
# Copy to ${NTRIP_BRIDGE_CONFIG_PATH} and edit the values below.
#   sudo cp ${NTRIP_BRIDGE_CONFIG_DIR}/config.conf.example ${NTRIP_BRIDGE_CONFIG_PATH}
#   sudo nano ${NTRIP_BRIDGE_CONFIG_PATH}
# ----------------------------------------------------------------------------

# ---- NTRIP caster ----------------------------------------------------------
# Example: Vietnam national VRS caster
ntrip_host=vrs.vngeonet.vn
ntrip_port=2101
ntrip_mountpoint=VRS_RTCM3
ntrip_user=
ntrip_password=
ntrip_use_tls=false

# ---- MAVLink transport to PX4 ----------------------------------------------
# mavlink_type: 'serial' or 'udp'
mavlink_type=serial

# Serial link (UART to flight controller)
mavlink_serial_device=/dev/serial0
mavlink_serial_baud=921600

# UDP fallback (used when mavlink_type=udp)
mavlink_udp_host=127.0.0.1
mavlink_udp_port=14550

# ---- MAVLink identity ------------------------------------------------------
mavlink_sysid=255
mavlink_compid=190
target_sysid=1
target_compid=1

# ---- RTCM filtering --------------------------------------------------------
# Comma-separated RTCM3 message IDs to forward; empty = forward everything.
# Example: rtcm_whitelist=1005,1074,1084,1094,1124,1230
rtcm_whitelist=

# ---- Fallback position for GGA ---------------------------------------------
# Used only when no live position has been received from the vehicle yet.
# Uncomment and set to a point near your operating area.
# fixed_lat=21.028511
# fixed_lon=105.804817
# fixed_alt=10.0
")

#------------------------------------------------------------------------------
# Install rules
#------------------------------------------------------------------------------
include(GNUInstallDirs)

# Binary -> /usr/local/bin/ntrip_bridge (CMAKE_INSTALL_PREFIX defaults to
# /usr/local on Linux, so CMAKE_INSTALL_BINDIR = bin resolves correctly).
install(TARGETS ntrip_bridge
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

# Systemd unit -> /etc/systemd/system/ntrip-bridge.service
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/ntrip-bridge.service"
    DESTINATION /etc/systemd/system
    PERMISSIONS
        OWNER_READ OWNER_WRITE
        GROUP_READ
        WORLD_READ
)

# Example config -> /etc/ntrip-bridge/config.conf.example
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/config.conf.example"
    DESTINATION ${NTRIP_BRIDGE_CONFIG_DIR}
    PERMISSIONS
        OWNER_READ OWNER_WRITE
        GROUP_READ
        WORLD_READ
)

#------------------------------------------------------------------------------
# Deployment help printed at configure time
#------------------------------------------------------------------------------
message(STATUS "")
message(STATUS "----------------------------------------------------------------")
message(STATUS " NTRIP Bridge build configured")
message(STATUS "   Version:    ${PROJECT_VERSION}")
message(STATUS "   Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "   Compiler:   ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "   MAVLink:    ${mavlink_headers_SOURCE_DIR}")
message(STATUS "   Includes:   ${MAVLINK_STAGED_INCLUDE_DIR}")
message(STATUS "               (code uses <mavlink/common/mavlink.h>)")
message(STATUS "----------------------------------------------------------------")
message(STATUS " Next steps:")
message(STATUS "   Build:   cmake --build ${CMAKE_BINARY_DIR} -j$(nproc)")
message(STATUS "   Install: sudo cmake --install ${CMAKE_BINARY_DIR}")
message(STATUS "   Config:  sudo cp ${NTRIP_BRIDGE_CONFIG_DIR}/config.conf.example \\")
message(STATUS "                    ${NTRIP_BRIDGE_CONFIG_PATH}")
message(STATUS "            sudo nano ${NTRIP_BRIDGE_CONFIG_PATH}   # set credentials")
message(STATUS "   Enable:  sudo systemctl daemon-reload")
message(STATUS "            sudo systemctl enable --now ntrip-bridge")
message(STATUS "   Logs:    journalctl -u ntrip-bridge -f")
message(STATUS "----------------------------------------------------------------")
message(STATUS "")
