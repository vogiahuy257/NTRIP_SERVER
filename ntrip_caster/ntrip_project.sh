#!/usr/bin/env bash
set -Eeuo pipefail

# One-command production setup for the Laravel NTRIP Caster project.
# Default usage from the project root:
#   chmod +x ntrip_project.sh
#   ./ntrip_project.sh

PHP_VERSION="${PHP_VERSION:-8.3}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}"
COMMAND="${1:-install}"

APP_NAME="${APP_NAME:-NtripCaster}"
# Public address used by browsers and NTRIP clients.
# It may be either a public IPv4 address for testing or a public FQDN/domain.
# Backward-compatible aliases: PUBLIC_HOSTNAME, PUBLIC_IP and APP_HOST.
PUBLISH_HOST_OVERRIDE="${PUBLISH_HOST:-${PUBLIC_HOSTNAME:-${PUBLIC_IP:-${APP_HOST:-}}}}"
APP_SCHEME="${APP_SCHEME:-http}"
HTTP_PORT="${HTTP_PORT:-8000}"
VITE_PORT="${VITE_PORT:-5173}"
SSH_PORT="${SSH_PORT:-22}"
EXPOSE_VITE_DEV="${EXPOSE_VITE_DEV:-false}"
APP_URL_OVERRIDE="${APP_URL:-}"
LOCAL_IP_OVERRIDE="${LOCAL_IP:-}"
REQUIRE_PUBLIC_DNS="${REQUIRE_PUBLIC_DNS:-true}"
NTRIP_PUBLIC_HOST_OVERRIDE="${NTRIP_PUBLIC_HOST:-}"
REVERB_PUBLIC_HOST_OVERRIDE="${REVERB_PUBLIC_HOST:-}"

SERVER_HOSTNAME=""
LOCAL_SERVER_IP=""
PUBLISH_HOST_RESOLVED=""
PUBLISH_HOST_KIND=""
PUBLISH_HOST_IPV4S=""
APP_HOST=""
APP_URL=""
NTRIP_PUBLIC_HOST_RESOLVED=""
REVERB_PUBLIC_HOST_RESOLVED=""
SANCTUM_DOMAINS_RESOLVED=""
NGINX_SERVER_NAMES="_"
NETWORK_IDENTITY_RESOLVED=false

POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-ntrip_caster}"
POSTGRES_USER="${POSTGRES_USER:-ntrip_app}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_MAXMEMORY="${REDIS_MAXMEMORY:-}"
REDIS_SERVICE_NAME="${REDIS_SERVICE_NAME:-redis-server}"
REDIS_CONFIG_FILE="${REDIS_CONFIG_FILE:-/etc/redis/ntrip-redis.conf}"

REVERB_PORT="${REVERB_PORT:-8080}"
NTRIP_PORT="${NTRIP_PORT:-2101}"
NTRIP_OBSERVABILITY_PORT="${NTRIP_OBSERVABILITY_PORT:-22101}"
NTRIP_MANAGEMENT_PORT="${NTRIP_MANAGEMENT_PORT:-$HTTP_PORT}"
NTRIP_OBSERVER_COMMAND="${NTRIP_OBSERVER_COMMAND:-}"
RUN_TESTS="${RUN_TESTS:-false}"
FORCE_NEW_SECRETS="${FORCE_NEW_SECRETS:-false}"

if [[ "$EUID" -eq 0 ]]; then
    SUDO=""
    DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-$(stat -c '%U' "$PROJECT_DIR" 2>/dev/null || echo www-data)}}"
else
    command -v sudo >/dev/null 2>&1 || {
        printf '[FAIL] sudo is required when the script is not run as root.\n' >&2
        exit 1
    }
    SUDO="sudo"
    DEPLOY_USER="${DEPLOY_USER:-$(id -un)}"
fi
DEPLOY_GROUP="${DEPLOY_GROUP:-www-data}"

PHP_FPM_SERVICE="php${PHP_VERSION}-fpm"
PHP_FPM_SOCKET="/run/php/php${PHP_VERSION}-fpm.sock"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_DIR="$PROJECT_DIR/backup/setup"
SYSTEMD_PREFIX="ntrip-caster"

log()  { printf '\n\033[1;34m[NTRIP Project]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

on_error() {
    local exit_code=$?
    printf '\n\033[1;31m[FAIL]\033[0m Script stopped at line %s (exit code %s).\n' "${BASH_LINENO[0]:-unknown}" "$exit_code" >&2
    printf 'Review the messages above, fix the reported issue, then run ./ntrip_project.sh again.\n' >&2
    exit "$exit_code"
}
trap on_error ERR

is_true() {
    case "${1,,}" in
        1|true|yes|y|on) return 0 ;;
        *) return 1 ;;
    esac
}


is_valid_ipv4() {
    local ip="$1"
    local octet
    local -a octets

    IFS='.' read -r -a octets <<<"$ip"
    [[ "${#octets[@]}" -eq 4 ]] || return 1

    for octet in "${octets[@]}"; do
        [[ "$octet" =~ ^[0-9]{1,3}$ ]] || return 1
        (( 10#$octet >= 0 && 10#$octet <= 255 )) || return 1
    done

    return 0
}

is_loopback_or_link_local_ipv4() {
    local ip="$1"
    [[ "$ip" == 127.* || "$ip" == 169.254.* || "$ip" == "0.0.0.0" ]]
}

is_private_or_reserved_ipv4() {
    local ip="$1"
    local a b c d
    is_valid_ipv4 "$ip" || return 0
    IFS='.' read -r a b c d <<<"$ip"

    (( a == 0 || a == 10 || a == 127 )) && return 0
    (( a == 169 && b == 254 )) && return 0
    (( a == 172 && b >= 16 && b <= 31 )) && return 0
    (( a == 192 && b == 168 )) && return 0
    (( a == 100 && b >= 64 && b <= 127 )) && return 0
    (( a >= 224 )) && return 0

    return 1
}

detect_local_ipv4() {
    local candidate=""

    if [[ -n "$LOCAL_IP_OVERRIDE" ]]; then
        is_valid_ipv4 "$LOCAL_IP_OVERRIDE" || fail "LOCAL_IP is not a valid IPv4 address: $LOCAL_IP_OVERRIDE"
        printf '%s' "$LOCAL_IP_OVERRIDE"
        return 0
    fi

    if command_exists ip; then
        candidate="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}' || true)"
        if is_valid_ipv4 "$candidate" && ! is_loopback_or_link_local_ipv4 "$candidate"; then
            printf '%s' "$candidate"
            return 0
        fi
    fi

    if command_exists hostname; then
        while read -r candidate; do
            if is_valid_ipv4 "$candidate" && ! is_loopback_or_link_local_ipv4 "$candidate"; then
                printf '%s' "$candidate"
                return 0
            fi
        done < <(hostname -I 2>/dev/null | tr ' ' '\n' || true)
    fi

    return 1
}

is_valid_public_hostname() {
    local hostname_value="${1,,}"
    local label
    local -a labels=()

    [[ -n "$hostname_value" ]] || return 1
    [[ ${#hostname_value} -le 253 ]] || return 1
    [[ "$hostname_value" != "localhost" ]] || return 1
    [[ "$hostname_value" != *.local ]] || return 1
    [[ "$hostname_value" == *.* ]] || return 1
    is_valid_ipv4 "$hostname_value" && return 1

    IFS='.' read -r -a labels <<<"$hostname_value"
    for label in "${labels[@]}"; do
        [[ -n "$label" && ${#label} -le 63 ]] || return 1
        [[ "$label" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || return 1
    done

    return 0
}

is_valid_publish_host() {
    local host_value="${1,,}"

    if is_valid_ipv4 "$host_value"; then
        ! is_private_or_reserved_ipv4 "$host_value"
        return
    fi

    is_valid_public_hostname "$host_value"
}

publish_host_kind() {
    local host_value="$1"
    if is_valid_ipv4 "$host_value"; then
        printf 'ipv4'
    else
        printf 'hostname'
    fi
}

extract_hostname_from_url() {
    local url="$1"
    printf '%s' "$url" \
        | sed -E 's#^[A-Za-z][A-Za-z0-9+.-]*://([^/@]+@)?(\[[^]]+\]|[^/:?#]+).*$#\2#' \
        | tr -d '[]' \
        | tr '[:upper:]' '[:lower:]'
}

resolve_publish_host() {
    local candidate=""
    local existing_url=""

    if [[ -n "$PUBLISH_HOST_OVERRIDE" ]]; then
        candidate="${PUBLISH_HOST_OVERRIDE,,}"
    fi

    if [[ -z "$candidate" && -f "$ENV_FILE" ]]; then
        candidate="$(read_env_value PUBLISH_HOST || true)"
        candidate="${candidate,,}"
    fi

    if [[ -z "$candidate" && -f "$ENV_FILE" ]]; then
        candidate="$(read_env_value PUBLIC_HOSTNAME || true)"
        candidate="${candidate,,}"
        is_valid_publish_host "$candidate" || candidate=""
    fi

    if [[ -z "$candidate" && -f "$ENV_FILE" ]]; then
        candidate="$(read_env_value SERVER_PUBLIC_IP || true)"
        candidate="${candidate,,}"
        is_valid_publish_host "$candidate" || candidate=""
    fi

    if [[ -z "$candidate" && -f "$ENV_FILE" ]]; then
        existing_url="$(read_env_value APP_URL || true)"
        candidate="$(extract_hostname_from_url "$existing_url")"
        is_valid_publish_host "$candidate" || candidate=""
    fi

    if [[ -z "$candidate" ]]; then
        candidate="$(hostname -f 2>/dev/null || true)"
        candidate="${candidate,,}"
        is_valid_public_hostname "$candidate" || candidate=""
    fi

    if [[ -z "$candidate" && -t 0 ]]; then
        printf '
Public IPv4 or Internet hostname (example: YOUR_PUBLIC_IP or ntrip.example.com): ' >&2
        read -r candidate
        candidate="${candidate,,}"
    fi

    [[ -n "$candidate" ]] || fail \
        "A public IPv4 or Internet hostname is required. Example: PUBLISH_HOST=YOUR_PUBLIC_IP ./ntrip_project.sh"

    is_valid_publish_host "$candidate" || fail \
        "PUBLISH_HOST must be a public IPv4 address or valid public FQDN; localhost, private IPs and .local names are not accepted: $candidate"

    PUBLISH_HOST_RESOLVED="$candidate"
    PUBLISH_HOST_KIND="$(publish_host_kind "$candidate")"
}

resolve_hostname_ipv4s() {
    local hostname_value="$1"
    local addresses=""

    if command_exists getent; then
        addresses="$(getent ahostsv4 "$hostname_value" 2>/dev/null \
            | awk '{print $1}' \
            | awk '!seen[$0]++' \
            | paste -sd, - || true)"
    fi

    printf '%s' "$addresses"
}

verify_publish_host() {
    if [[ "$PUBLISH_HOST_KIND" == "ipv4" ]]; then
        PUBLISH_HOST_IPV4S="$PUBLISH_HOST_RESOLVED"
        ok "Using explicit public IPv4 address: $PUBLISH_HOST_RESOLVED"
        warn "If this public IP changes, rerun: PUBLISH_HOST=NEW_PUBLIC_IP ./ntrip_project.sh"
        return 0
    fi

    PUBLISH_HOST_IPV4S="$(resolve_hostname_ipv4s "$PUBLISH_HOST_RESOLVED")"

    if [[ -z "$PUBLISH_HOST_IPV4S" ]]; then
        if is_true "$REQUIRE_PUBLIC_DNS"; then
            fail "Public DNS does not currently resolve an IPv4 A record for $PUBLISH_HOST_RESOLVED. Create the record or configure DDNS, then run the script again. Set REQUIRE_PUBLIC_DNS=false only for staged setup."
        fi
        warn "Public DNS does not currently resolve an IPv4 A record for $PUBLISH_HOST_RESOLVED. Deployment will be configured, but it will not be reachable from the Internet until DNS is ready."
        return 0
    fi

    local ip
    local has_public_ipv4=false
    local -a resolved_ipv4s=()
    IFS=',' read -r -a resolved_ipv4s <<<"$PUBLISH_HOST_IPV4S"
    for ip in "${resolved_ipv4s[@]}"; do
        if ! is_private_or_reserved_ipv4 "$ip"; then
            has_public_ipv4=true
            break
        fi
    done

    if ! is_true "$has_public_ipv4"; then
        if is_true "$REQUIRE_PUBLIC_DNS"; then
            fail "$PUBLISH_HOST_RESOLVED resolves only to private/reserved IPv4 addresses: $PUBLISH_HOST_IPV4S"
        fi
        warn "$PUBLISH_HOST_RESOLVED resolves only to private/reserved IPv4 addresses: $PUBLISH_HOST_IPV4S"
        return 0
    fi

    ok "Public DNS: $PUBLISH_HOST_RESOLVED -> $PUBLISH_HOST_IPV4S"
}

join_unique_csv() {
    local -A seen=()
    local value
    local result=""

    for value in "$@"; do
        [[ -n "$value" ]] || continue
        [[ -z "${seen[$value]+x}" ]] || continue
        seen["$value"]=1
        result+="${result:+,}${value}"
    done

    printf '%s' "$result"
}

join_unique_spaces() {
    local -A seen=()
    local value
    local result=""

    for value in "$@"; do
        [[ -n "$value" ]] || continue
        [[ -z "${seen[$value]+x}" ]] || continue
        seen["$value"]=1
        result+="${result:+ }${value}"
    done

    printf '%s' "$result"
}

resolve_network_identity() {
    is_true "$NETWORK_IDENTITY_RESOLVED" && return 0

    SERVER_HOSTNAME="$(hostname -f 2>/dev/null || hostname 2>/dev/null || true)"
    SERVER_HOSTNAME="${SERVER_HOSTNAME:-localhost}"
    LOCAL_SERVER_IP="$(detect_local_ipv4 || true)"
    resolve_publish_host

    APP_HOST="$PUBLISH_HOST_RESOLVED"

    if [[ -n "$APP_URL_OVERRIDE" ]]; then
        APP_URL="$APP_URL_OVERRIDE"
    elif [[ "$HTTP_PORT" == "80" && "$APP_SCHEME" == "http" ]] || \
         [[ "$HTTP_PORT" == "443" && "$APP_SCHEME" == "https" ]]; then
        APP_URL="${APP_SCHEME}://${APP_HOST}"
    else
        APP_URL="${APP_SCHEME}://${APP_HOST}:${HTTP_PORT}"
    fi

    NTRIP_PUBLIC_HOST_RESOLVED="${NTRIP_PUBLIC_HOST_OVERRIDE:-$PUBLISH_HOST_RESOLVED}"
    REVERB_PUBLIC_HOST_RESOLVED="${REVERB_PUBLIC_HOST_OVERRIDE:-$PUBLISH_HOST_RESOLVED}"

    is_valid_publish_host "$NTRIP_PUBLIC_HOST_RESOLVED" || \
        fail "NTRIP_PUBLIC_HOST must be a public IPv4 address or public FQDN: $NTRIP_PUBLIC_HOST_RESOLVED"
    is_valid_publish_host "$REVERB_PUBLIC_HOST_RESOLVED" || \
        fail "REVERB_PUBLIC_HOST must be a public IPv4 address or public FQDN: $REVERB_PUBLIC_HOST_RESOLVED"

    local -a sanctum_entries=(
        "$PUBLISH_HOST_RESOLVED"
        "${PUBLISH_HOST_RESOLVED}:${HTTP_PORT}"
        "localhost"
        "localhost:${HTTP_PORT}"
        "127.0.0.1"
        "127.0.0.1:${HTTP_PORT}"
    )

    SANCTUM_DOMAINS_RESOLVED="$(join_unique_csv "${sanctum_entries[@]}")"
    NGINX_SERVER_NAMES="$(join_unique_spaces "$PUBLISH_HOST_RESOLVED" "$SERVER_HOSTNAME" "$LOCAL_SERVER_IP" "_")"
    NETWORK_IDENTITY_RESOLVED=true
}

print_network_identity() {
    resolve_network_identity
    log "Resolved server publishing identity"
    printf 'System hostname     : %s\n' "$SERVER_HOSTNAME"
    printf 'Local IPv4         : %s\n' "${LOCAL_SERVER_IP:-not detected}"
    printf 'Publish host       : %s (%s)\n' "$PUBLISH_HOST_RESOLVED" "$PUBLISH_HOST_KIND"
    verify_publish_host
    printf 'Resolved IPv4      : %s\n' "${PUBLISH_HOST_IPV4S:-not resolved}"
    printf 'Application URL    : %s\n' "$APP_URL"
    printf 'NTRIP endpoint     : %s:%s\n' "$NTRIP_PUBLIC_HOST_RESOLVED" "$NTRIP_PORT"

    if [[ "$PUBLISH_HOST_KIND" == "hostname" ]]; then
        warn "A hostname remains stable only when its DNS record is maintained. If the WAN IP is dynamic, configure DDNS at your DNS provider/router."
    else
        warn "This deployment is using a raw public IP for testing. HTTPS certificates and stable client configuration are easier after assigning a domain."
    fi
    warn "Required Internet TCP ports: ${SSH_PORT} SSH, ${HTTP_PORT} Laravel Web/API, ${REVERB_PORT} Reverb and ${NTRIP_PORT} NTRIP."

    if is_true "$EXPOSE_VITE_DEV"; then
        warn "Vite development/HMR is enabled on TCP ${VITE_PORT}. Restrict this port to your development IP."
    fi
}

require_supported_os() {
    [[ "$(uname -s)" == "Linux" ]] || fail "This script supports Linux only."
    [[ -r /etc/os-release ]] || fail "/etc/os-release was not found."
    # shellcheck disable=SC1091
    source /etc/os-release
    [[ "${ID:-}" == "ubuntu" ]] || fail "This script currently supports Ubuntu only. Detected: ${ID:-unknown}."
}

require_project() {
    [[ -d "$PROJECT_DIR" ]] || fail "PROJECT_DIR does not exist: $PROJECT_DIR"
    [[ -f "$PROJECT_DIR/artisan" ]] || fail "artisan was not found in PROJECT_DIR=$PROJECT_DIR"
    [[ -f "$PROJECT_DIR/composer.json" ]] || fail "composer.json was not found in PROJECT_DIR=$PROJECT_DIR"
    [[ -f "$PROJECT_DIR/package.json" ]] || fail "package.json was not found in PROJECT_DIR=$PROJECT_DIR"
}

ensure_deploy_identity() {
    id "$DEPLOY_USER" >/dev/null 2>&1 || fail "Deploy user does not exist: $DEPLOY_USER"
    getent group "$DEPLOY_GROUP" >/dev/null 2>&1 || $SUDO groupadd --system "$DEPLOY_GROUP"
}

acquire_lock() {
    command -v flock >/dev/null 2>&1 || return 0
    exec 9>"$PROJECT_DIR/.ntrip_project.lock"
    flock -n 9 || fail "Another ntrip_project.sh process is already running."
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

random_hex() {
    local bytes="${1:-24}"
    openssl rand -hex "$bytes"
}

random_numeric_id() {
    od -An -N4 -tu4 /dev/urandom | tr -d '[:space:]'
}

read_env_value() {
    local key="$1"
    local value=""
    [[ -f "$ENV_FILE" ]] || return 1

    value="$(grep -m1 -E "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
    value="${value%$'\r'}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
        value="${value:1:${#value}-2}"
        value="${value//\\\"/\"}"
        value="${value//\\\\/\\}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
        value="${value:1:${#value}-2}"
    fi

    [[ -n "$value" ]] || return 1
    printf '%s' "$value"
}

set_env_value() {
    local key="$1"
    local value="$2"

    php -r '
        $file = $argv[1];
        $key = $argv[2];
        $value = $argv[3];

        if (str_contains($value, "\n") || str_contains($value, "\r")) {
            fwrite(STDERR, "Environment values cannot contain newlines.\n");
            exit(1);
        }

        $quoted = "\"" . addcslashes($value, "\\\"") . "\"";
        $line = $key . "=" . $quoted;
        $contents = file_exists($file) ? file_get_contents($file) : "";
        $pattern = "/^" . preg_quote($key, "/") . "=.*$/m";

        if (preg_match($pattern, $contents) === 1) {
            $contents = preg_replace($pattern, $line, $contents, 1);
        } else {
            if ($contents !== "" && ! str_ends_with($contents, "\n")) {
                $contents .= "\n";
            }
            $contents .= $line . "\n";
        }

        if (file_put_contents($file, $contents) === false) {
            fwrite(STDERR, "Cannot write environment file.\n");
            exit(1);
        }
    ' "$ENV_FILE" "$key" "$value"
}

set_env_literal() {
    local key="$1"
    local literal="$2"

    [[ "$literal" =~ ^(null|true|false|[0-9]+)$ ]] || \
        fail "Unsupported raw .env literal for ${key}: ${literal}"

    php -r '
        $file = $argv[1];
        $key = $argv[2];
        $literal = $argv[3];
        $line = $key . "=" . $literal;
        $contents = file_exists($file) ? file_get_contents($file) : "";
        $pattern = "/^" . preg_quote($key, "/") . "=.*$/m";

        if (preg_match($pattern, $contents) === 1) {
            $contents = preg_replace($pattern, $line, $contents, 1);
        } else {
            if ($contents !== "" && ! str_ends_with($contents, "\n")) {
                $contents .= "\n";
            }
            $contents .= $line . "\n";
        }

        if (file_put_contents($file, $contents) === false) {
            fwrite(STDERR, "Cannot write environment file.\n");
            exit(1);
        }
    ' "$ENV_FILE" "$key" "$literal"
}

backup_env() {
    [[ -f "$ENV_FILE" ]] || return 0
    mkdir -p "$BACKUP_DIR"
    local backup_file="$BACKUP_DIR/.env.$(date +%Y%m%d_%H%M%S).backup"
    cp -a "$ENV_FILE" "$backup_file"
    ok "Existing .env backed up to $backup_file"
}

should_rotate_secrets() {
    is_true "$FORCE_NEW_SECRETS" && return 0
    [[ "$(read_env_value APP_ENV || true)" != "production" ]]
}

resolve_secret() {
    local key="$1"
    local bytes="$2"
    local current=""

    if ! should_rotate_secrets; then
        current="$(read_env_value "$key" || true)"
    fi

    if [[ -n "$current" ]]; then
        printf '%s' "$current"
    else
        random_hex "$bytes"
    fi
}

resolve_postgres_password() {
    [[ -n "$POSTGRES_PASSWORD" ]] && return 0

    if ! should_rotate_secrets; then
        POSTGRES_PASSWORD="$(read_env_value DB_PASSWORD || true)"
    fi

    if [[ -z "$POSTGRES_PASSWORD" ]]; then
        POSTGRES_PASSWORD="$(random_hex 24)"
        ok "Generated a strong PostgreSQL application password."
    fi
}

install_composer() {
    if command_exists composer; then
        ok "Composer already installed: $(composer --version --no-ansi 2>/dev/null | head -n1)"
        return 0
    fi

    log "Installing Composer with signature verification"
    local temp_dir expected actual
    temp_dir="$(mktemp -d)"
    expected="$(curl -fsSL https://composer.github.io/installer.sig)"
    curl -fsSL https://getcomposer.org/installer -o "$temp_dir/composer-setup.php"
    actual="$(php -r "echo hash_file('sha384', '$temp_dir/composer-setup.php');")"
    [[ "$expected" == "$actual" ]] || fail "Composer installer signature verification failed."

    $SUDO php "$temp_dir/composer-setup.php" \
        --quiet \
        --install-dir=/usr/local/bin \
        --filename=composer
    rm -rf "$temp_dir"
    ok "Composer installed."
}

install_node() {
    local install_required=true

    if command_exists node; then
        local current_major
        current_major="$(node -p 'process.versions.node.split(".")[0]')"
        if (( current_major >= NODE_MAJOR )); then
            install_required=false
            ok "Node.js already installed: $(node --version)"
        else
            warn "Node.js $(node --version) is older than the requested ${NODE_MAJOR}.x."
        fi
    fi

    if is_true "$install_required"; then
        log "Installing Node.js ${NODE_MAJOR}.x"
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
        $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
    fi
}

resolve_redis_maxmemory() {
    if [[ -n "$REDIS_MAXMEMORY" ]]; then
        printf '%s' "$REDIS_MAXMEMORY"
        return 0
    fi

    local total_mb
    total_mb="$(
        awk '/MemTotal/ {
            print int($2 / 1024)
        }' /proc/meminfo
    )"

    if (( total_mb >= 16000 )); then
        printf '1gb'
    elif (( total_mb >= 8000 )); then
        printf '512mb'
    else
        printf '256mb'
    fi
}

write_redis_managed_config() {
    local maxmemory="$1"
    local redis_directory="/var/lib/redis"

    $SUDO install -d -m 0750 -o redis -g redis "$redis_directory"
    $SUDO install -d -m 0755 -o root -g root "$(dirname "$REDIS_CONFIG_FILE")"

    $SUDO tee "$REDIS_CONFIG_FILE" >/dev/null <<CONF
# Managed by ntrip_project.sh. Manual edits may be overwritten.
bind 127.0.0.1
protected-mode yes
port ${REDIS_PORT}
tcp-backlog 511
timeout 0
tcp-keepalive 60

daemonize no
supervised systemd
loglevel notice
logfile ""
always-show-logo no

databases 16
dir ${redis_directory}
dbfilename dump.rdb

save 3600 1
save 300 100
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

appendonly yes
appendfilename "appendonly.aof"
appenddirname "appendonlydir"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

maxmemory ${maxmemory}
maxmemory-policy noeviction
CONF

    $SUDO chown root:redis "$REDIS_CONFIG_FILE"
    $SUDO chmod 640 "$REDIS_CONFIG_FILE"
}

write_redis_systemd_override() {
    local redis_service="$1"
    local redis_binary
    local override_directory

    redis_binary="$(command -v redis-server)"
    [[ -n "$redis_binary" ]] || fail "redis-server binary was not found."

    override_directory="/etc/systemd/system/${redis_service}.service.d"
    $SUDO install -d -m 0755 "$override_directory"

    $SUDO tee "$override_directory/override.conf" >/dev/null <<UNIT
[Unit]
After=network-online.target ntrip-disable-transparent-huge-pages.service
Wants=network-online.target

[Service]
ExecStart=
ExecStart=${redis_binary} ${REDIS_CONFIG_FILE} --supervised systemd
UNIT
}

detect_redis_service_name() {
    if systemctl list-unit-files redis-server.service >/dev/null 2>&1; then
        printf 'redis-server'
        return 0
    fi

    if systemctl list-unit-files redis.service >/dev/null 2>&1; then
        printf 'redis'
        return 0
    fi

    printf '%s' "$REDIS_SERVICE_NAME"
}

install_redis_repository() {
    local keyring="/usr/share/keyrings/redis-archive-keyring.gpg"
    local source_file="/etc/apt/sources.list.d/redis.list"
    local codename

    codename="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME:-}")"
    [[ -n "$codename" ]] || codename="$(lsb_release -cs)"

    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        ca-certificates curl gpg lsb-release

    if [[ ! -s "$keyring" ]]; then
        log "Installing the official Redis APT signing key"
        curl -fsSL https://packages.redis.io/gpg |
            $SUDO gpg --dearmor --yes -o "$keyring"
        $SUDO chmod 644 "$keyring"
    fi

    local expected_source
    expected_source="deb [signed-by=${keyring}] https://packages.redis.io/deb ${codename} main"

    if [[ ! -f "$source_file" ]] || \
       ! grep -Fxq "$expected_source" "$source_file"; then
        printf '%s\n' "$expected_source" |
            $SUDO tee "$source_file" >/dev/null
        ok "Official Redis APT repository configured."
    fi
}

configure_redis_kernel() {
    log "Applying Redis Linux kernel settings"

    printf 'vm.overcommit_memory = 1\n' |
        $SUDO tee /etc/sysctl.d/99-ntrip-redis.conf >/dev/null

    $SUDO sysctl --system >/dev/null

    $SUDO tee \
        /etc/systemd/system/ntrip-disable-transparent-huge-pages.service \
        >/dev/null <<'UNIT'
[Unit]
Description=Disable Transparent Huge Pages for Redis
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=redis-server.service redis.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'if [ -f /sys/kernel/mm/transparent_hugepage/enabled ]; then echo never > /sys/kernel/mm/transparent_hugepage/enabled; fi'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT

    $SUDO systemctl daemon-reload
    $SUDO systemctl enable --now \
        ntrip-disable-transparent-huge-pages.service
}

configure_redis_server() {
    [[ "$REDIS_HOST" == "127.0.0.1" || "$REDIS_HOST" == "localhost" ]] || \
        fail "The bundled Redis setup supports localhost only. REDIS_HOST=$REDIS_HOST"

    local maxmemory
    maxmemory="$(resolve_redis_maxmemory)"

    log "Configuring Redis for local Laravel cache, queue and session workloads"

    configure_redis_kernel

    REDIS_SERVICE_NAME="$(detect_redis_service_name)"

    write_redis_managed_config "$maxmemory"
    write_redis_systemd_override "$REDIS_SERVICE_NAME"

    $SUDO systemctl daemon-reload
    $SUDO systemctl enable --now "$REDIS_SERVICE_NAME"

    if ! $SUDO systemctl restart "$REDIS_SERVICE_NAME"; then
        $SUDO systemctl status "$REDIS_SERVICE_NAME" --no-pager || true
        $SUDO journalctl -u "$REDIS_SERVICE_NAME" -n 80 --no-pager || true
        fail "Redis failed to restart with ${REDIS_CONFIG_FILE}."
    fi

    if command_exists ufw && \
       $SUDO ufw status 2>/dev/null | grep -q '^Status: active'; then
        $SUDO ufw deny "${REDIS_PORT}/tcp" >/dev/null 2>&1 || true
    fi

    ok "Redis configured with ${REDIS_CONFIG_FILE}, maxmemory=${maxmemory}, AOF everysec and noeviction."
}

check_redis_environment() {
    local errors=0
    local redis_service
    local listener_output=""

    redis_service="$(detect_redis_service_name)"

    command_exists redis-server || {
        warn "redis-server is missing"
        errors=$((errors + 1))
    }

    command_exists redis-cli || {
        warn "redis-cli is missing"
        errors=$((errors + 1))
    }

    if ! php -m |
        tr '[:upper:]' '[:lower:]' |
        grep -qx redis; then
        warn "PHP extension missing: redis"
        errors=$((errors + 1))
    else
        ok "PHP extension: redis"
    fi

    if systemctl is-active --quiet "$redis_service"; then
        ok "Service active: $redis_service"
    else
        warn "Required service is not active: $redis_service"
        errors=$((errors + 1))
    fi

    if command_exists redis-cli && \
       [[ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --raw PING 2>/dev/null || true)" == "PONG" ]]; then
        ok "Redis PING: PONG"
    else
        warn "Redis PING failed at ${REDIS_HOST}:${REDIS_PORT}"
        errors=$((errors + 1))
    fi

    local listener_addresses=""

    listener_output="$(
        $SUDO ss -H -ltnp 2>/dev/null |
            awk -v port="$REDIS_PORT" '$4 ~ (":" port "$") { print }' ||
            true
    )"

    listener_addresses="$(
        awk '{ print $4 }' <<<"$listener_output" |
            sort -u
    )"

    if [[ -z "$listener_output" ]]; then
        warn "Redis is not listening on TCP ${REDIS_PORT}"
        errors=$((errors + 1))
    else
        local listener_address
        local public_listener=false

        while IFS= read -r listener_address; do
            [[ -n "$listener_address" ]] || continue

            case "$listener_address" in
                "127.0.0.1:${REDIS_PORT}"|"[::1]:${REDIS_PORT}")
                    ;;
                *)
                    public_listener=true
                    ;;
            esac
        done <<<"$listener_addresses"

        if is_true "$public_listener"; then
            warn "Redis is listening on a non-loopback interface."
            printf '%s\n' "$listener_output"
            errors=$((errors + 1))
        else
            ok "Redis listens on localhost only: ${listener_addresses//$'\n'/, }"
        fi
    fi

    if command_exists redis-cli; then
        local protected_mode appendonly appendfsync maxmemory_policy

        protected_mode="$(
            redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
                --raw CONFIG GET protected-mode 2>/dev/null |
                tail -n 1
        )"

        appendonly="$(
            redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
                --raw CONFIG GET appendonly 2>/dev/null |
                tail -n 1
        )"

        appendfsync="$(
            redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
                --raw CONFIG GET appendfsync 2>/dev/null |
                tail -n 1
        )"

        maxmemory_policy="$(
            redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
                --raw CONFIG GET maxmemory-policy 2>/dev/null |
                tail -n 1
        )"

        [[ "$protected_mode" == "yes" ]] || {
            warn "Redis protected-mode must be yes"
            errors=$((errors + 1))
        }

        [[ "$appendonly" == "yes" ]] || {
            warn "Redis appendonly must be yes"
            errors=$((errors + 1))
        }

        [[ "$appendfsync" == "everysec" ]] || {
            warn "Redis appendfsync must be everysec"
            errors=$((errors + 1))
        }

        [[ "$maxmemory_policy" == "noeviction" ]] || {
            warn "Redis maxmemory-policy must be noeviction"
            errors=$((errors + 1))
        }
    fi

    if [[ "$errors" -eq 0 ]]; then
        ok "Redis installation and security checks passed."
        return 0
    fi

    return 1
}

install_redis_environment() {
    require_supported_os

    local needs_install=false

    command_exists redis-server || needs_install=true
    command_exists redis-cli || needs_install=true

    if ! php -m |
        tr '[:upper:]' '[:lower:]' |
        grep -qx redis; then
        needs_install=true
    fi

    if is_true "$needs_install"; then
        log "Installing Redis and PhpRedis"

        install_redis_repository
        $SUDO apt-get update

        $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
            redis \
            "php${PHP_VERSION}-redis"
    else
        ok "Redis and PhpRedis are already installed."
    fi

    configure_redis_server

    if systemctl list-unit-files "$PHP_FPM_SERVICE.service" >/dev/null 2>&1; then
        $SUDO systemctl restart "$PHP_FPM_SERVICE"
    fi

    check_redis_environment || fail "Redis installation or configuration check failed."
}

configure_redis_env() {
    [[ -f "$ENV_FILE" ]] || fail ".env is missing."

    set_env_value REDIS_CLIENT "phpredis"
    set_env_value REDIS_HOST "$REDIS_HOST"
    set_env_literal REDIS_PASSWORD "null"
    set_env_value REDIS_PORT "$REDIS_PORT"

    set_env_value REDIS_DB "0"
    set_env_value REDIS_CACHE_DB "1"
    set_env_value REDIS_QUEUE_DB "2"
    set_env_value REDIS_SESSION_DB "3"
    set_env_value REDIS_PREFIX "ntrip:"

    ok "Redis connection settings were written to .env."
}

install_system_environment() {
    require_supported_os

    log "Updating Ubuntu package metadata"
    $SUDO apt-get update

    log "Installing base packages, Nginx, PostgreSQL and build tools"
    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        acl ca-certificates curl dnsutils git gnupg iproute2 lsb-release nginx openssl \
        postgresql postgresql-client postgresql-contrib \
        software-properties-common unzip

    if ! apt-cache show "php${PHP_VERSION}-cli" >/dev/null 2>&1; then
        log "Adding the maintained PHP package repository"
        $SUDO add-apt-repository -y ppa:ondrej/php
        $SUDO apt-get update
    fi

    log "Installing PHP ${PHP_VERSION} and required extensions"
    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        "php${PHP_VERSION}-bcmath" \
        "php${PHP_VERSION}-cli" \
        "php${PHP_VERSION}-common" \
        "php${PHP_VERSION}-curl" \
        "php${PHP_VERSION}-fpm" \
        "php${PHP_VERSION}-intl" \
        "php${PHP_VERSION}-mbstring" \
        "php${PHP_VERSION}-opcache" \
        "php${PHP_VERSION}-pgsql" \
        "php${PHP_VERSION}-xml" \
        "php${PHP_VERSION}-zip"

    if [[ -x "/usr/bin/php${PHP_VERSION}" ]]; then
        $SUDO update-alternatives --set php "/usr/bin/php${PHP_VERSION}" >/dev/null 2>&1 || true
    fi

    install_redis_environment
    install_composer
    install_node

    $SUDO systemctl enable --now postgresql "$PHP_FPM_SERVICE" nginx
    ok "System packages and core services are installed."
}

configure_deployment_env() {
    require_project
    resolve_network_identity
    resolve_postgres_password

    local app_key="" reverb_app_id="" reverb_app_key reverb_app_secret provisioning_key
    if ! should_rotate_secrets; then
        app_key="$(read_env_value APP_KEY || true)"
        reverb_app_id="$(read_env_value REVERB_APP_ID || true)"
    fi

    if [[ -z "$reverb_app_id" ]]; then
        reverb_app_id="$(random_numeric_id)"
    fi

    reverb_app_key="$(resolve_secret REVERB_APP_KEY 16)"
    reverb_app_secret="$(resolve_secret REVERB_APP_SECRET 32)"
    provisioning_key="$(resolve_secret NTRIP_PROVISIONING_KEY 32)"

    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$PROJECT_DIR/.env.example" ]]; then
            cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
            ok ".env created from .env.example"
        else
            : > "$ENV_FILE"
            ok "A new .env file was created."
        fi
    else
        backup_env
    fi

    # Remove legacy or overriding keys before writing the public-address deployment config.
    sed -i -E '/^DB_URL=/d' "$ENV_FILE"

    # Application
    set_env_value APP_NAME "$APP_NAME"
    set_env_value APP_ENV "production"
    set_env_value APP_KEY "$app_key"
    set_env_value APP_DEBUG "false"
    set_env_value APP_URL "$APP_URL"
    set_env_value PUBLISH_HOST "$PUBLISH_HOST_RESOLVED"
    # Compatibility key retained for older application code/scripts.
    set_env_value PUBLIC_HOSTNAME "$PUBLISH_HOST_RESOLVED"
    if [[ "$PUBLISH_HOST_KIND" == "ipv4" ]]; then
        set_env_value SERVER_PUBLIC_IP "$PUBLISH_HOST_RESOLVED"
    else
        sed -i -E '/^SERVER_PUBLIC_IP=/d' "$ENV_FILE"
    fi
    set_env_value SERVER_HOSTNAME "$SERVER_HOSTNAME"
    set_env_value SERVER_LOCAL_IP "$LOCAL_SERVER_IP"
    set_env_value APP_LOCALE "en"
    set_env_value APP_FALLBACK_LOCALE "en"
    set_env_value APP_FAKER_LOCALE "en_US"
    set_env_value APP_MAINTENANCE_DRIVER "file"
    set_env_value APP_TIMEZONE "Asia/Ho_Chi_Minh"
    set_env_value SANCTUM_STATEFUL_DOMAINS "$SANCTUM_DOMAINS_RESOLVED"
    set_env_value BCRYPT_ROUNDS "12"

    # Logging
    set_env_value LOG_CHANNEL "stack"
    set_env_value LOG_STACK "single"
    set_env_value LOG_DEPRECATIONS_CHANNEL "null"
    set_env_value LOG_LEVEL "info"

    # PostgreSQL
    set_env_value DB_CONNECTION "pgsql"
    set_env_value DB_HOST "$POSTGRES_HOST"
    set_env_value DB_PORT "$POSTGRES_PORT"
    set_env_value DB_DATABASE "$POSTGRES_DB"
    set_env_value DB_USERNAME "$POSTGRES_USER"
    set_env_value DB_PASSWORD "$POSTGRES_PASSWORD"

    # Laravel runtime stores
    set_env_value SESSION_DRIVER "database"
    set_env_value SESSION_LIFETIME "120"
    set_env_value SESSION_ENCRYPT "false"
    set_env_value SESSION_PATH "/"
    set_env_value SESSION_DOMAIN "null"
    set_env_value BROADCAST_CONNECTION "reverb"
    set_env_value FILESYSTEM_DISK "local"
    set_env_value QUEUE_CONNECTION "database"
    set_env_value CACHE_STORE "database"

    # Redis is installed and verified now. Runtime stores remain on
    # database until the Laravel Redis migration is applied separately.
    set_env_value MEMCACHED_HOST "127.0.0.1"
    configure_redis_env

    # Mail defaults
    set_env_value MAIL_MAILER "log"
    set_env_value MAIL_SCHEME "null"
    set_env_value MAIL_HOST "127.0.0.1"
    set_env_value MAIL_PORT "2525"
    set_env_value MAIL_USERNAME "null"
    set_env_value MAIL_PASSWORD "null"
    set_env_value MAIL_FROM_ADDRESS "hello@example.com"
    set_env_value MAIL_FROM_NAME '${APP_NAME}'

    # AWS placeholders
    set_env_value AWS_ACCESS_KEY_ID ""
    set_env_value AWS_SECRET_ACCESS_KEY ""
    set_env_value AWS_DEFAULT_REGION "us-east-1"
    set_env_value AWS_BUCKET ""
    set_env_value AWS_USE_PATH_STYLE_ENDPOINT "false"

    # Vite and Reverb
    set_env_value VITE_APP_NAME '${APP_NAME}'
    set_env_value VITE_APP_URL "$APP_URL"
    set_env_value VITE_DEV_HOST "0.0.0.0"
    set_env_value VITE_DEV_PORT "$VITE_PORT"
    set_env_value VITE_DEV_SERVER_ENABLED "$EXPOSE_VITE_DEV"

    set_env_value REVERB_APP_ID "$reverb_app_id"
    set_env_value REVERB_APP_KEY "$reverb_app_key"
    set_env_value REVERB_APP_SECRET "$reverb_app_secret"
    set_env_value REVERB_HOST "127.0.0.1"
    set_env_value REVERB_PORT "$REVERB_PORT"
    set_env_value REVERB_SCHEME "http"
    set_env_value REVERB_SERVER_HOST "0.0.0.0"
    set_env_value REVERB_SERVER_PORT "$REVERB_PORT"
    set_env_value VITE_REVERB_APP_KEY '${REVERB_APP_KEY}'
    set_env_value VITE_REVERB_HOST "$REVERB_PUBLIC_HOST_RESOLVED"
    set_env_value VITE_REVERB_PORT "$REVERB_PORT"
    set_env_value VITE_REVERB_SCHEME "http"

    # NTRIP caster and observability
    set_env_value NTRIP_HOST "0.0.0.0"
    set_env_value NTRIP_PORT "$NTRIP_PORT"
    set_env_value NTRIP_PUBLIC_HOST "$NTRIP_PUBLIC_HOST_RESOLVED"
    set_env_value NTRIP_MANAGEMENT_PORT "$NTRIP_MANAGEMENT_PORT"
    set_env_value NTRIP_PROVISIONING_KEY "$provisioning_key"
    set_env_value NTRIP_OBSERVABILITY_ENABLED "true"
    set_env_value NTRIP_OBSERVABILITY_DRIVER "udp"
    set_env_value NTRIP_OBSERVABILITY_HOST "127.0.0.1"
    set_env_value NTRIP_OBSERVABILITY_PORT "$NTRIP_OBSERVABILITY_PORT"
    set_env_value NTRIP_OBSERVABILITY_SNAPSHOT_MS "1000"
    set_env_value NTRIP_OBSERVABILITY_BIND_HOST "127.0.0.1"
    set_env_value ALERT_ENGINE_ENABLED "true"

    chmod 640 "$ENV_FILE"
    $SUDO chown "$DEPLOY_USER:$DEPLOY_GROUP" "$ENV_FILE"
    ok ".env now contains the complete production PostgreSQL deployment configuration."
}

run_as_postgres() {
    if [[ "$EUID" -eq 0 ]]; then
        runuser -u postgres -- "$@"
    else
        sudo -u postgres "$@"
    fi
}

validate_postgres_identifier() {
    local value="$1"
    local label="$2"
    [[ "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || \
        fail "$label must match ^[A-Za-z_][A-Za-z0-9_]*$: $value"
}

setup_postgres() {
    validate_postgres_identifier "$POSTGRES_DB" "POSTGRES_DB"
    validate_postgres_identifier "$POSTGRES_USER" "POSTGRES_USER"
    resolve_postgres_password

    if [[ "$POSTGRES_HOST" != "127.0.0.1" && "$POSTGRES_HOST" != "localhost" ]]; then
        log "Using remote PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}; skipping local role/database creation."
    else
        log "Creating or updating the local PostgreSQL role and database"
        $SUDO systemctl enable --now postgresql

        run_as_postgres psql \
            --dbname=postgres \
            --set=ON_ERROR_STOP=1 \
            --set=db_user="$POSTGRES_USER" \
            --set=db_password="$POSTGRES_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_password')
\gexec
SQL

        run_as_postgres psql \
            --dbname=postgres \
            --set=ON_ERROR_STOP=1 \
            --set=db_name="$POSTGRES_DB" \
            --set=db_user="$POSTGRES_USER" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8''', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'db_user')
\gexec
SQL
    fi

    log "Testing PostgreSQL application credentials"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        --host="$POSTGRES_HOST" \
        --port="$POSTGRES_PORT" \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --set=ON_ERROR_STOP=1 \
        --command='SELECT current_database(), current_user;' \
        >/dev/null
    ok "PostgreSQL database connection is ready."
}

install_project_dependencies() {
    require_project
    cd "$PROJECT_DIR"

    log "Installing optimized PHP dependencies"
    COMPOSER_ALLOW_SUPERUSER=1 composer install \
        --no-dev \
        --prefer-dist \
        --no-interaction \
        --optimize-autoloader

    log "Installing exact Node.js dependencies"
    if [[ -f package-lock.json ]]; then
        npm ci
    else
        npm install
    fi

    APP_KEY_VALUE="$(
        grep -m1 '^APP_KEY=' .env 2>/dev/null |
        cut -d= -f2- |
        tr -d '"'\'''
    )"

    if [[ -z "$APP_KEY_VALUE" ]]; then
        log "Generating the Laravel application key"
        php artisan key:generate --force
    else
        ok "Laravel APP_KEY is already configured."
    fi

    log "Clearing Laravel file caches before database migration"

    # Không dùng optimize:clear ở đây vì CACHE_STORE=database
    # và bảng cache có thể chưa được migration tạo ra.
    rm -f bootstrap/cache/*.php 2>/dev/null || true

    mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        bootstrap/cache

    php artisan config:clear
    php artisan route:clear
    php artisan view:clear
    php artisan event:clear

    log "Running PostgreSQL migrations"
    php artisan migrate --force

    log "Clearing Laravel database cache after migrations"
    php artisan cache:clear

    php artisan storage:link --force >/dev/null 2>&1 || true

    log "Building the production frontend"
    npm run build

    if is_true "$RUN_TESTS"; then
        log "Running backend automated tests"
        if composer run-script --list 2>/dev/null | grep -q 'test:backend'; then
            composer test:backend
        else
            php artisan test
        fi
    fi

    log "Caching Laravel production configuration"
    php artisan config:cache
    php artisan view:cache
    php artisan route:cache || warn "Route cache was skipped because the application contains non-cacheable routes."

    ok "Laravel dependencies, migrations and frontend build are complete."
}

configure_permissions() {
    require_project
    ensure_deploy_identity

    log "Configuring Laravel and web-server permissions"

    mkdir -p \
        "$PROJECT_DIR/storage/framework/cache/data" \
        "$PROJECT_DIR/storage/framework/sessions" \
        "$PROJECT_DIR/storage/framework/views" \
        "$PROJECT_DIR/storage/logs" \
        "$PROJECT_DIR/bootstrap/cache"

    # Cho phép PHP-FPM/Nginx đi xuyên qua các thư mục cha,
    # đặc biệt khi dự án nằm trong /home/<user>/...
    if command_exists setfacl; then
        local current_path="$PROJECT_DIR"

        while [[ "$current_path" != "/" ]]; do
            $SUDO setfacl -m "u:www-data:--x" "$current_path"
            current_path="$(dirname "$current_path")"
        done

        # PHP-FPM cần đọc source Laravel, vendor, routes, config và public.
        $SUDO setfacl -R -m "u:www-data:r-X" "$PROJECT_DIR"
    else
        warn "setfacl is unavailable. Installing package 'acl' is recommended."

        # Phương án dự phòng: chỉ cấp quyền traverse cho thư mục home.
        if [[ "$PROJECT_DIR" == /home/* ]]; then
            local home_directory
            home_directory="/home/$(printf '%s' "$PROJECT_DIR" | cut -d/ -f3)"
            $SUDO chmod o+x "$home_directory"
        fi
    fi

    # storage và bootstrap/cache phải ghi được bởi Laravel.
    $SUDO chown -R "$DEPLOY_USER:$DEPLOY_GROUP" \
        "$PROJECT_DIR/storage" \
        "$PROJECT_DIR/bootstrap/cache"

    $SUDO find \
        "$PROJECT_DIR/storage" \
        "$PROJECT_DIR/bootstrap/cache" \
        -type d -exec chmod 2775 {} +

    $SUDO find \
        "$PROJECT_DIR/storage" \
        "$PROJECT_DIR/bootstrap/cache" \
        -type f -exec chmod 664 {} +

    # public chỉ cần đọc và traverse.
    $SUDO find "$PROJECT_DIR/public" -type d -exec chmod 755 {} +
    $SUDO find "$PROJECT_DIR/public" -type f -exec chmod 644 {} +

    # index.php không cần quyền thực thi, PHP-FPM chỉ cần đọc.
    $SUDO chmod 644 "$PROJECT_DIR/public/index.php"

    $SUDO chmod 640 "$ENV_FILE"
    $SUDO chown "$DEPLOY_USER:$DEPLOY_GROUP" "$ENV_FILE"

    # Xác minh user PHP-FPM thực sự đọc được Laravel entry point.
    if ! $SUDO -u www-data test -r "$PROJECT_DIR/public/index.php"; then
        fail "www-data cannot read $PROJECT_DIR/public/index.php"
    fi

    if ! $SUDO -u www-data test -r "$PROJECT_DIR/vendor/autoload.php"; then
        fail "www-data cannot read $PROJECT_DIR/vendor/autoload.php"
    fi

    ok "Laravel runtime and Nginx/PHP-FPM permissions are configured."
}

artisan_has_command() {
    local command_name="$1"
    (cd "$PROJECT_DIR" && php artisan list --raw 2>/dev/null | awk '{print $1}' | grep -qx "$command_name")
}

write_systemd_service() {
    local service_name="$1"
    local description="$2"
    local artisan_command="$3"
    local restart_seconds="${4:-3}"
    local php_binary
    php_binary="$(command -v php)"

    $SUDO tee "/etc/systemd/system/${service_name}.service" >/dev/null <<UNIT
[Unit]
Description=${description}
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=${DEPLOY_USER}
Group=${DEPLOY_GROUP}
WorkingDirectory=${PROJECT_DIR}
ExecStart=${php_binary} ${PROJECT_DIR}/artisan ${artisan_command}
Restart=always
RestartSec=${restart_seconds}
KillSignal=SIGTERM
TimeoutStopSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
}

resolve_observer_command() {
    [[ -n "$NTRIP_OBSERVER_COMMAND" ]] && return 0

    local candidate
    for candidate in \
        ntrip:observe \
        ntrip:observer \
        ntrip:observability \
        ntrip:observe-udp \
        observability:listen; do
        if artisan_has_command "$candidate"; then
            NTRIP_OBSERVER_COMMAND="$candidate"
            return 0
        fi
    done
}

configure_systemd_services() {
    require_project
    ensure_deploy_identity

    log "Creating Laravel/NTRIP systemd services"

    if artisan_has_command reverb:start; then
        write_systemd_service \
            "${SYSTEMD_PREFIX}-reverb" \
            "NTRIP Caster Laravel Reverb WebSocket Server" \
            "reverb:start --host=0.0.0.0 --port=${REVERB_PORT}"
    else
        warn "Artisan command reverb:start was not found; Reverb service was not created."
    fi

    if artisan_has_command queue:work; then
        write_systemd_service \
            "${SYSTEMD_PREFIX}-queue" \
            "NTRIP Caster Laravel Queue Worker" \
            "queue:work database --sleep=1 --tries=3 --timeout=120 --max-time=3600"
    else
        warn "Artisan command queue:work was not found; queue service was not created."
    fi

    if artisan_has_command schedule:work; then
        write_systemd_service \
            "${SYSTEMD_PREFIX}-scheduler" \
            "NTRIP Caster Laravel Scheduler" \
            "schedule:work"
    else
        warn "Artisan command schedule:work was not found; scheduler service was not created."
    fi

    if artisan_has_command ntrip:serve; then
        write_systemd_service \
            "${SYSTEMD_PREFIX}-server" \
            "NTRIP Caster TCP Server" \
            "ntrip:serve"
    else
        warn "Artisan command ntrip:serve was not found; NTRIP TCP service was not created."
    fi

    resolve_observer_command
    if [[ -n "$NTRIP_OBSERVER_COMMAND" ]]; then
        write_systemd_service \
            "${SYSTEMD_PREFIX}-observer" \
            "NTRIP Caster Observability Receiver" \
            "$NTRIP_OBSERVER_COMMAND"
    else
        warn "No known observability Artisan command was detected. Set NTRIP_OBSERVER_COMMAND when your command uses another name."
    fi

    $SUDO systemctl daemon-reload

    local unit
    for unit in \
        "${SYSTEMD_PREFIX}-reverb" \
        "${SYSTEMD_PREFIX}-queue" \
        "${SYSTEMD_PREFIX}-scheduler" \
        "${SYSTEMD_PREFIX}-server" \
        "${SYSTEMD_PREFIX}-observer"; do
        if [[ -f "/etc/systemd/system/${unit}.service" ]]; then
            $SUDO systemctl enable --now "$unit"
            $SUDO systemctl restart "$unit"
        fi
    done

    ok "Available NTRIP application services were installed and started."
}

configure_nginx() {
    require_project
    resolve_network_identity

    [[ -S "$PHP_FPM_SOCKET" ]] || \
        fail "PHP-FPM socket was not found: $PHP_FPM_SOCKET"

    [[ -f "$PROJECT_DIR/public/index.php" ]] || \
        fail "Laravel public/index.php was not found."

    local site_file="/etc/nginx/sites-available/ntrip_caster"

    log "Configuring Nginx for Laravel on port $HTTP_PORT"

    $SUDO tee "$site_file" >/dev/null <<NGINX
server {
    listen ${HTTP_PORT} default_server;
    listen [::]:${HTTP_PORT} default_server;

    server_name ${NGINX_SERVER_NAMES};

    root ${PROJECT_DIR}/public;
    index index.php index.html;

    charset utf-8;
    client_max_body_size 20M;

    access_log /var/log/nginx/ntrip_caster_access.log;
    error_log /var/log/nginx/ntrip_caster_error.log;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location = /favicon.ico {
        access_log off;
        log_not_found off;
    }

    location = /robots.txt {
        access_log off;
        log_not_found off;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;

        fastcgi_pass unix:${PHP_FPM_SOCKET};

        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT \$realpath_root;

        # Laravel/Inertia/Fortify có thể tạo response header lớn.
        # Các buffer này ngăn lỗi:
        # "upstream sent too big header"
        fastcgi_buffer_size 32k;
        fastcgi_buffers 16 16k;
        fastcgi_busy_buffers_size 64k;
        fastcgi_temp_file_write_size 64k;

        fastcgi_connect_timeout 60s;
        fastcgi_send_timeout 120s;
        fastcgi_read_timeout 120s;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
NGINX

    $SUDO rm -f /etc/nginx/sites-enabled/default

    $SUDO ln -sfn \
        "$site_file" \
        /etc/nginx/sites-enabled/ntrip_caster

    log "Validating Nginx configuration"
    $SUDO nginx -t

    $SUDO systemctl enable --now "$PHP_FPM_SERVICE" nginx
    $SUDO systemctl restart "$PHP_FPM_SERVICE"
    $SUDO systemctl restart nginx

    log "Testing Laravel through Nginx"

    local http_code
    http_code="$(
        curl \
            --silent \
            --show-error \
            --output /dev/null \
            --write-out '%{http_code}' \
            --max-time 15 \
            -H "Host: $APP_HOST" \
            "http://127.0.0.1:${HTTP_PORT}/up" \
            || true
    )"

    if [[ "$http_code" =~ ^(2|3)[0-9][0-9]$ ]]; then
        ok "Nginx and Laravel responded with HTTP $http_code."
    else
        warn "Nginx/Laravel returned HTTP ${http_code:-000}."
        $SUDO tail -n 30 /var/log/nginx/ntrip_caster_error.log 2>/dev/null || true
        fail "Nginx configuration was created, but the Laravel health check failed."
    fi

    ok "Nginx is serving the project at $APP_URL"
}

configure_firewall_if_active() {
    if ! command_exists ufw; then
        return 0
    fi

    if $SUDO ufw status 2>/dev/null | grep -q '^Status: active'; then
        log "Opening required ports in the active UFW firewall"
        $SUDO ufw allow "${SSH_PORT}/tcp"
        $SUDO ufw allow "${HTTP_PORT}/tcp"
        $SUDO ufw allow "${REVERB_PORT}/tcp"
        $SUDO ufw allow "${NTRIP_PORT}/tcp"

        if is_true "$EXPOSE_VITE_DEV"; then
            $SUDO ufw allow "${VITE_PORT}/tcp"
        fi
        ok "UFW rules added for SSH, Laravel Web/API, Reverb and NTRIP."

        if is_true "$EXPOSE_VITE_DEV"; then
            ok "UFW rule added for Vite development server."
        fi
    fi
}

check_php_environment() {
    local errors=0
    local required_extensions=(
        bcmath ctype curl dom fileinfo filter hash intl json mbstring
        openssl pcntl pdo pdo_pgsql redis session tokenizer xml zip
    )

    command_exists php || { warn "php is missing"; return 1; }

    local php_version
    php_version="$(php -r 'echo PHP_VERSION;')"
    ok "PHP version: $php_version"

    if ! php -r "exit(version_compare(PHP_VERSION, '${PHP_VERSION}.0', '>=') ? 0 : 1);"; then
        warn "PHP $php_version is older than ${PHP_VERSION}.0"
        errors=$((errors + 1))
    fi

    local loaded_extensions
    loaded_extensions="$(php -m | tr '[:upper:]' '[:lower:]')"
    local extension
    for extension in "${required_extensions[@]}"; do
        if grep -qx "$extension" <<<"$loaded_extensions"; then
            ok "PHP extension: $extension"
        else
            warn "PHP extension missing: $extension"
            errors=$((errors + 1))
        fi
    done

    [[ "$errors" -eq 0 ]]
}

check_required_env_keys() {
    local errors=0
    local required_keys=(
        APP_NAME APP_ENV APP_KEY APP_DEBUG APP_URL PUBLISH_HOST PUBLIC_HOSTNAME
        SERVER_HOSTNAME SERVER_LOCAL_IP
        SANCTUM_STATEFUL_DOMAINS
        DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD
        SESSION_DRIVER BROADCAST_CONNECTION QUEUE_CONNECTION CACHE_STORE
        REDIS_CLIENT REDIS_HOST REDIS_PASSWORD REDIS_PORT
        REDIS_DB REDIS_CACHE_DB REDIS_QUEUE_DB REDIS_SESSION_DB REDIS_PREFIX
        REVERB_APP_ID REVERB_APP_KEY REVERB_APP_SECRET
        REVERB_HOST REVERB_PORT REVERB_SCHEME
        REVERB_SERVER_HOST REVERB_SERVER_PORT
        VITE_REVERB_APP_KEY VITE_REVERB_HOST VITE_REVERB_PORT VITE_REVERB_SCHEME
        NTRIP_HOST NTRIP_PORT NTRIP_PUBLIC_HOST NTRIP_MANAGEMENT_PORT
        NTRIP_PROVISIONING_KEY
        NTRIP_OBSERVABILITY_ENABLED NTRIP_OBSERVABILITY_DRIVER
        NTRIP_OBSERVABILITY_HOST NTRIP_OBSERVABILITY_PORT
        NTRIP_OBSERVABILITY_SNAPSHOT_MS NTRIP_OBSERVABILITY_BIND_HOST
        ALERT_ENGINE_ENABLED
    )

    [[ -f "$ENV_FILE" ]] || { warn ".env is missing"; return 1; }

    local key
    for key in "${required_keys[@]}"; do
        if grep -qE "^${key}=" "$ENV_FILE"; then
            ok ".env key: $key"
        else
            warn ".env key missing: $key"
            errors=$((errors + 1))
        fi
    done

    if [[ "$(read_env_value DB_CONNECTION || true)" != "pgsql" ]]; then
        warn "DB_CONNECTION must be pgsql"
        errors=$((errors + 1))
    fi

    if [[ "$(read_env_value APP_ENV || true)" != "production" ]]; then
        warn "APP_ENV must be production"
        errors=$((errors + 1))
    fi

    if [[ "$(read_env_value APP_DEBUG || true)" != "false" ]]; then
        warn "APP_DEBUG must be false"
        errors=$((errors + 1))
    fi

    [[ "$errors" -eq 0 ]]
}

check_service() {
    local service="$1"
    local required="${2:-true}"

    if systemctl is-active --quiet "$service"; then
        ok "Service active: $service"
    elif is_true "$required"; then
        warn "Required service is not active: $service"
        return 1
    else
        warn "Optional service is not active or not installed: $service"
    fi
}

check_deployment() {
    require_project
    resolve_network_identity
    local errors=0

    print_network_identity

    log "Checking installed commands"
    local command_name
    for command_name in php composer node npm git curl ip unzip psql pg_isready nginx redis-server redis-cli; do
        if command_exists "$command_name"; then
            ok "$command_name: $(command -v "$command_name")"
        else
            warn "$command_name is missing"
            errors=$((errors + 1))
        fi
    done

    log "Checking PHP"
    check_php_environment || errors=$((errors + 1))

    log "Checking deployment .env"
    check_required_env_keys || errors=$((errors + 1))

    if [[ -f "$ENV_FILE" ]]; then
        local configured_local_ip configured_publish_host configured_app_url
        configured_local_ip="$(read_env_value SERVER_LOCAL_IP || true)"
        configured_publish_host="$(read_env_value PUBLISH_HOST || true)"
        configured_app_url="$(read_env_value APP_URL || true)"

        if [[ -n "$LOCAL_SERVER_IP" && "$configured_local_ip" != "$LOCAL_SERVER_IP" ]]; then
            warn ".env SERVER_LOCAL_IP=${configured_local_ip:-empty}, but the current local IP is $LOCAL_SERVER_IP. Run ./ntrip_project.sh env to update it."
        fi
        if [[ "$configured_publish_host" != "$PUBLISH_HOST_RESOLVED" ]]; then
            warn ".env PUBLISH_HOST=${configured_publish_host:-empty}, expected $PUBLISH_HOST_RESOLVED. Run ./ntrip_project.sh env to update it."
            errors=$((errors + 1))
        fi
        verify_publish_host || errors=$((errors + 1))
        if [[ -n "$configured_app_url" ]]; then
            ok "Configured APP_URL: $configured_app_url"
        fi

        resolve_postgres_password
        log "Checking PostgreSQL connection"
        if PGPASSWORD="$POSTGRES_PASSWORD" pg_isready \
            --host="$POSTGRES_HOST" \
            --port="$POSTGRES_PORT" \
            --username="$POSTGRES_USER" \
            --dbname="$POSTGRES_DB" >/dev/null 2>&1; then
            ok "PostgreSQL accepts connections."
        else
            warn "PostgreSQL connection failed."
            errors=$((errors + 1))
        fi
    fi

    log "Checking Redis"
    check_redis_environment || errors=$((errors + 1))

    log "Checking core services"
    check_service postgresql || errors=$((errors + 1))
    check_service "$PHP_FPM_SERVICE" || errors=$((errors + 1))
    check_service nginx || errors=$((errors + 1))

    local optional_unit
    for optional_unit in \
        "${SYSTEMD_PREFIX}-reverb" \
        "${SYSTEMD_PREFIX}-queue" \
        "${SYSTEMD_PREFIX}-scheduler" \
        "${SYSTEMD_PREFIX}-server" \
        "${SYSTEMD_PREFIX}-observer"; do
        if [[ -f "/etc/systemd/system/${optional_unit}.service" ]]; then
            check_service "$optional_unit" || errors=$((errors + 1))
        fi
    done

    if systemctl is-active --quiet nginx; then
        local http_code
        http_code="$(curl -sS -o /dev/null -w '%{http_code}' \
            -H "Host: $APP_HOST" \
            "http://127.0.0.1:${HTTP_PORT}/" || true)"
        if [[ "$http_code" =~ ^(2|3|4)[0-9][0-9]$ ]]; then
            ok "Nginx/Laravel responded with HTTP $http_code."
        else
            warn "Nginx/Laravel health request failed with HTTP ${http_code:-000}."
            errors=$((errors + 1))
        fi
    fi

    if [[ "$errors" -gt 0 ]]; then
        fail "Deployment check found $errors problem group(s)."
    fi

    ok "The complete NTRIP Caster deployment check passed."
}

full_install() {
    require_project
    acquire_lock
    ensure_deploy_identity

    log "Starting one-command NTRIP Caster production setup"
    printf 'Project directory : %s\n' "$PROJECT_DIR"
    printf 'Deploy user       : %s:%s\n' "$DEPLOY_USER" "$DEPLOY_GROUP"
    printf 'PostgreSQL DB     : %s@%s:%s/%s\n' "$POSTGRES_USER" "$POSTGRES_HOST" "$POSTGRES_PORT" "$POSTGRES_DB"

    install_system_environment
    print_network_identity
    printf 'NTRIP endpoint    : %s:%s\n' "$NTRIP_PUBLIC_HOST_RESOLVED" "$NTRIP_PORT"
    printf 'Reverb endpoint   : %s:%s\n' "$REVERB_PUBLIC_HOST_RESOLVED" "$REVERB_PORT"

    configure_deployment_env
    setup_postgres
    install_project_dependencies
    configure_permissions
    configure_nginx
    configure_systemd_services
    configure_firewall_if_active
    check_deployment

    cat <<SUMMARY

============================================================
NTRIP Caster deployment completed successfully.

Web dashboard  : ${APP_URL}
Publish host   : ${PUBLISH_HOST_RESOLVED} (${PUBLISH_HOST_KIND})
Server local   : ${LOCAL_SERVER_IP:-not detected}
NTRIP caster   : ${NTRIP_PUBLIC_HOST_RESOLVED}:${NTRIP_PORT}
Reverb         : ${REVERB_PUBLIC_HOST_RESOLVED}:${REVERB_PORT}
Project        : ${PROJECT_DIR}
Environment    : ${ENV_FILE}

Useful commands:
  ./ntrip_project.sh check
  sudo systemctl status ${SYSTEMD_PREFIX}-server
  sudo systemctl status ${SYSTEMD_PREFIX}-reverb
  sudo journalctl -u ${SYSTEMD_PREFIX}-server -f
  sudo journalctl -u ${SYSTEMD_PREFIX}-reverb -f

First deployment using a public IP:
  PUBLISH_HOST=YOUR_PUBLIC_IP ./ntrip_project.sh

Later, when a domain is available:
  PUBLISH_HOST=ntrip.example.com ./ntrip_project.sh

The selected public address is saved in .env and reused on later runs.
When using a raw IP, rerun the command if the public IP changes.
============================================================
SUMMARY
}

release_project() {
    require_project
    acquire_lock

    [[ -f "$ENV_FILE" ]] || \
        fail ".env is missing. Run the full installation before using release."

    cd "$PROJECT_DIR"

    log "Starting CI/CD application release"
    printf 'Project directory : %s\n' "$PROJECT_DIR"
    printf 'Git commit        : %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

    install_redis_environment
    configure_redis_env

    log "Installing optimized PHP dependencies"
    COMPOSER_ALLOW_SUPERUSER=1 composer install \
        --no-dev \
        --prefer-dist \
        --no-interaction \
        --optimize-autoloader

    log "Installing exact Node.js dependencies"
    if [[ -f package-lock.json ]]; then
        npm ci
    else
        npm install
    fi

    log "Clearing Laravel file caches"

    rm -f bootstrap/cache/*.php 2>/dev/null || true

    mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache

    php artisan config:clear
    php artisan route:clear
    php artisan view:clear
    php artisan event:clear 2>/dev/null || true

    log "Running pending PostgreSQL migrations"

    # migrate chỉ chạy migration mới, không xóa database hiện có.
    php artisan migrate --force

    php artisan storage:link --force >/dev/null 2>&1 || true

    log "Building production frontend"
    npm run build

    log "Caching Laravel production configuration"
    php artisan config:cache
    php artisan view:cache

    php artisan route:cache || \
        warn "Route cache was skipped because non-cacheable routes exist."

    log "Restarting application services"

    if [[ ! -x /usr/local/sbin/ntrip-restart-services ]]; then
        fail "/usr/local/sbin/ntrip-restart-services was not found."
    fi

    sudo -n /usr/local/sbin/ntrip-restart-services

    log "Checking deployment after release"
    check_deployment

    ok "CI/CD application release completed successfully."
}

reset_database() {
    require_project
    [[ -f "$ENV_FILE" ]] || fail ".env is missing."
    warn "This permanently deletes all application tables and data in PostgreSQL."
    read -r -p "Type RESET to continue: " confirmation
    [[ "$confirmation" == "RESET" ]] || fail "Database reset cancelled."
    (cd "$PROJECT_DIR" && php artisan migrate:fresh --force)
    ok "PostgreSQL database reset completed."
}

show_help() {
    cat <<HELP
Usage:
  ./ntrip_project.sh                 Full automatic production installation
  ./ntrip_project.sh install         Same as the default command
  ./ntrip_project.sh check           Verify packages, Redis, publish address, .env, PostgreSQL and services
  ./ntrip_project.sh network         Display public IP/domain and local IPv4
  ./ntrip_project.sh env             Create/update the production PostgreSQL .env
  ./ntrip_project.sh database        Create/update and test PostgreSQL
  ./ntrip_project.sh deploy          Install app dependencies, migrate and build
  ./ntrip_project.sh services        Configure Nginx and systemd services
  ./ntrip_project.sh reset-db        Destructively recreate all database tables
  ./ntrip_project.sh release         Update code dependencies, migrate, build and restart services
  ./ntrip_project.sh help            Show this help

Common optional environment variables:
  PROJECT_DIR=/home/user/NTRIP_SERVER/ntrip_caster
  PUBLISH_HOST=YOUR_PUBLIC_IP       Public IPv4 for testing, or a public FQDN
  PUBLIC_IP=YOUR_PUBLIC_IP          Backward-compatible IPv4 alias
  PUBLIC_HOSTNAME=ntrip.example.com Backward-compatible hostname alias
  APP_HOST=ntrip.example.com        Backward-compatible alias
  LOCAL_IP=192.168.1.50              Optional local IPv4 override
  REQUIRE_PUBLIC_DNS=true            Fail when the hostname does not resolve
  REVERB_PUBLIC_HOST=YOUR_PUBLIC_IP Optional Reverb public IP/FQDN override
  NTRIP_PUBLIC_HOST=YOUR_PUBLIC_IP  Optional NTRIP public IP/FQDN override
  HTTP_PORT=8000
  VITE_PORT=5173
  SSH_PORT=22
  EXPOSE_VITE_DEV=false
  PHP_VERSION=8.3
  NODE_MAJOR=22

  REDIS_HOST=127.0.0.1
  REDIS_PORT=6379
  REDIS_MAXMEMORY=512mb             Optional override; auto-sized by default

  POSTGRES_HOST=127.0.0.1
  POSTGRES_PORT=5432
  POSTGRES_DB=ntrip_caster
  POSTGRES_USER=ntrip_app
  POSTGRES_PASSWORD=strong-secret

  REVERB_PORT=8080
  NTRIP_PORT=2101
  NTRIP_OBSERVER_COMMAND=ntrip:observe
  RUN_TESTS=true
  FORCE_NEW_SECRETS=true

Examples:
  chmod +x ntrip_project.sh
  ./ntrip_project.sh

  PUBLISH_HOST=YOUR_PUBLIC_IP ./ntrip_project.sh

  PUBLISH_HOST=YOUR_PUBLIC_IP POSTGRES_PASSWORD='replace-with-a-strong-password' ./ntrip_project.sh

  PUBLISH_HOST=ntrip.example.com ./ntrip_project.sh

  REQUIRE_PUBLIC_DNS=false PUBLISH_HOST=ntrip.example.com ./ntrip_project.sh env
HELP
}

case "$COMMAND" in
    install|setup|all)
        full_install
        ;;
    check)
        check_deployment
        ;;
    network|hostname|dns)
        print_network_identity
        ;;
    env|configure-env|configure-db)
        require_project
        install_system_environment
        configure_deployment_env
        ;;
    database|setup-db)
        require_project
        install_system_environment
        configure_deployment_env
        setup_postgres
        ;;
    deploy)
        require_project
        install_system_environment
        configure_deployment_env
        setup_postgres
        install_project_dependencies
        configure_permissions
        ;;
    services)
        require_project
        configure_permissions
        configure_nginx
        configure_systemd_services
        configure_firewall_if_active
        ;;
    release|cicd-deploy)
        release_project
        ;;
    reset-db)
        reset_database
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        fail "Unknown command: $COMMAND"
        ;;
esac