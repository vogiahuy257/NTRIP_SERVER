#!/usr/bin/env bash
set -Eeuo pipefail

PHP_VERSION="${PHP_VERSION:-8.3}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
COMMAND="${1:-help}"

POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-ntrip_caster}"
POSTGRES_USER="${POSTGRES_USER:-ntrip_app}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

if [[ "${EUID}" -eq 0 ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

log() { printf '\n\033[1;34m[NTRIP Project]\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

require_project() {
    [[ -f "$PROJECT_DIR/artisan" ]] || fail "artisan not found in PROJECT_DIR=$PROJECT_DIR"
    [[ -f "$PROJECT_DIR/composer.json" ]] || fail "composer.json not found in PROJECT_DIR=$PROJECT_DIR"
}

check_command() {
    local name="$1"

    if command -v "$name" >/dev/null 2>&1; then
        ok "$name: $(command -v "$name")"
    else
        warn "$name is missing"
        return 1
    fi
}

check_environment() {
    local errors=0
    log "Checking environment"

    for command_name in php composer node npm git curl unzip psql pg_isready; do
        check_command "$command_name" || errors=$((errors + 1))
    done

    if command -v php >/dev/null 2>&1; then
        ok "PHP version: $(php -r 'echo PHP_VERSION;')"

        local required_extensions=(
            bcmath ctype curl dom fileinfo filter hash intl json mbstring
            openssl pcntl pdo pdo_pgsql session tokenizer xml zip
        )
        local loaded_extensions
        loaded_extensions="$(php -m | tr '[:upper:]' '[:lower:]')"

        for extension in "${required_extensions[@]}"; do
            if grep -qx "$extension" <<<"$loaded_extensions"; then
                ok "PHP extension: $extension"
            else
                warn "PHP extension missing: $extension"
                errors=$((errors + 1))
            fi
        done
    fi

    if command -v systemctl >/dev/null 2>&1; then
        if systemctl is-active --quiet postgresql; then
            ok "PostgreSQL service is active"
        else
            warn "PostgreSQL service is not active"
            errors=$((errors + 1))
        fi
    fi

    [[ "$errors" -eq 0 ]] || fail "Environment check found $errors problem(s)"
    ok "Environment is ready"
}

install_composer() {
    if command -v composer >/dev/null 2>&1; then
        ok "Composer already installed"
        return
    fi

    local temp_dir expected actual
    temp_dir="$(mktemp -d)"
    expected="$(curl -fsSL https://composer.github.io/installer.sig)"
    curl -fsSL https://getcomposer.org/installer -o "$temp_dir/composer-setup.php"
    actual="$(php -r "echo hash_file('sha384', '$temp_dir/composer-setup.php');")"
    [[ "$expected" == "$actual" ]] || fail "Composer installer signature verification failed"

    $SUDO php "$temp_dir/composer-setup.php" \
        --quiet \
        --install-dir=/usr/local/bin \
        --filename=composer

    rm -rf "$temp_dir"
    ok "Composer installed"
}

install_node() {
    if command -v node >/dev/null 2>&1; then
        local current_major
        current_major="$(node -p 'process.versions.node.split(".")[0]')"

        if (( current_major >= 20 )); then
            ok "Node.js already installed: $(node --version)"
            return
        fi
    fi

    log "Installing Node.js ${NODE_MAJOR}.x"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
}

run_as_postgres() {
    if [[ "${EUID}" -eq 0 ]]; then
        runuser -u postgres -- "$@"
    else
        sudo -u postgres "$@"
    fi
}

validate_postgres_identifier() {
    local value="$1"
    local label="$2"

    [[ "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] \
        || fail "$label must match ^[A-Za-z_][A-Za-z0-9_]*$: $value"
}

read_env_value() {
    local key="$1"
    local env_file="$PROJECT_DIR/.env"
    local value=""

    [[ -f "$env_file" ]] || return 1

    value="$(grep -m1 -E "^${key}=" "$env_file" 2>/dev/null | cut -d= -f2- || true)"
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

resolve_postgres_password() {
    if [[ -n "$POSTGRES_PASSWORD" ]]; then
        return
    fi

    local existing_password=""
    existing_password="$(read_env_value DB_PASSWORD || true)"

    if [[ -n "$existing_password" ]]; then
        POSTGRES_PASSWORD="$existing_password"
        return
    fi

    [[ -t 0 ]] || fail \
        "POSTGRES_PASSWORD is required in non-interactive mode"

    local password_confirm=""
    read -r -s -p "PostgreSQL password for ${POSTGRES_USER}: " POSTGRES_PASSWORD
    printf '\n'
    [[ -n "$POSTGRES_PASSWORD" ]] || fail "PostgreSQL password cannot be empty"

    read -r -s -p "Confirm PostgreSQL password: " password_confirm
    printf '\n'
    [[ "$POSTGRES_PASSWORD" == "$password_confirm" ]] \
        || fail "PostgreSQL passwords do not match"
}

set_env_value() {
    local key="$1"
    local value="$2"
    local env_file="$PROJECT_DIR/.env"

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

        $contents = file_exists($file)
            ? file_get_contents($file)
            : "";

        $pattern = "/^" . preg_quote($key, "/") . "=.*$/m";

        if (preg_match($pattern, $contents) === 1) {
            $contents = preg_replace($pattern, $line, $contents, 1);
        } else {
            if ($contents !== "" && ! str_ends_with($contents, "\n")) {
                $contents .= "\n";
            }

            $contents .= $line . "\n";
        }

        file_put_contents($file, $contents);
    ' "$env_file" "$key" "$value"
}

configure_env_postgres() {
    require_project
    cd "$PROJECT_DIR"

    if [[ ! -f .env ]]; then
        cp .env.example .env
        warn ".env was created from .env.example"
    fi

    resolve_postgres_password

    # DB_URL may override the individual DB_* values in Laravel.
    sed -i -E '/^DB_URL=/d' .env

    set_env_value DB_CONNECTION pgsql
    set_env_value DB_HOST "$POSTGRES_HOST"
    set_env_value DB_PORT "$POSTGRES_PORT"
    set_env_value DB_DATABASE "$POSTGRES_DB"
    set_env_value DB_USERNAME "$POSTGRES_USER"
    set_env_value DB_PASSWORD "$POSTGRES_PASSWORD"

    chmod 600 .env
    ok "Laravel .env configured for PostgreSQL"
}

setup_postgres() {
    validate_postgres_identifier "$POSTGRES_DB" "POSTGRES_DB"
    validate_postgres_identifier "$POSTGRES_USER" "POSTGRES_USER"

    if [[ "$POSTGRES_HOST" != "127.0.0.1" && "$POSTGRES_HOST" != "localhost" ]]; then
        fail "setup-db creates a local PostgreSQL database only. Current POSTGRES_HOST=$POSTGRES_HOST"
    fi

    resolve_postgres_password

    log "Starting PostgreSQL"
    $SUDO systemctl enable --now postgresql

    log "Creating or updating PostgreSQL role"
    run_as_postgres psql \
        --dbname=postgres \
        --set=ON_ERROR_STOP=1 \
        --set=db_user="$POSTGRES_USER" \
        --set=db_password="$POSTGRES_PASSWORD" <<'SQL'
SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L',
    :'db_user',
    :'db_password'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = :'db_user'
)
\gexec

SELECT format(
    'ALTER ROLE %I WITH LOGIN PASSWORD %L',
    :'db_user',
    :'db_password'
)
\gexec
SQL

    log "Creating PostgreSQL database when missing"
    run_as_postgres psql \
        --dbname=postgres \
        --set=ON_ERROR_STOP=1 \
        --set=db_name="$POSTGRES_DB" \
        --set=db_user="$POSTGRES_USER" <<'SQL'
SELECT format(
    'CREATE DATABASE %I OWNER %I ENCODING ''UTF8''',
    :'db_name',
    :'db_user'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = :'db_name'
)
\gexec

SELECT format(
    'ALTER DATABASE %I OWNER TO %I',
    :'db_name',
    :'db_user'
)
\gexec
SQL

    log "Testing PostgreSQL application connection"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        --host="$POSTGRES_HOST" \
        --port="$POSTGRES_PORT" \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --set=ON_ERROR_STOP=1 \
        --command='SELECT current_database(), current_user;' \
        >/dev/null

    ok "PostgreSQL database and application role are ready"
}

setup_env() {
    [[ "$(uname -s)" == "Linux" ]] || fail "This script supports Linux only"
    source /etc/os-release
    [[ "${ID:-}" == "ubuntu" ]] || fail "This script currently supports Ubuntu only"

    log "Updating package metadata"
    $SUDO apt-get update

    log "Installing base packages and PostgreSQL"
    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        ca-certificates curl git gnupg lsb-release netcat-openbsd nginx \
        postgresql postgresql-client postgresql-contrib \
        software-properties-common supervisor unzip

    if ! apt-cache show "php${PHP_VERSION}-cli" >/dev/null 2>&1; then
        log "Adding PHP repository"
        $SUDO add-apt-repository -y ppa:ondrej/php
        $SUDO apt-get update
    fi

    log "Installing PHP ${PHP_VERSION}"
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

    if [[ -x "/usr/bin/php${PHP_VERSION}" ]] \
        && update-alternatives --list php >/dev/null 2>&1; then
        $SUDO update-alternatives --set php "/usr/bin/php${PHP_VERSION}"
    fi

    install_composer
    install_node

    $SUDO systemctl enable --now postgresql

    if ! php -m | grep -qi '^pcntl$'; then
        warn "PCNTL is not loaded. On Ubuntu it is normally included with PHP CLI."
        warn "Check with: php --ri pcntl"
    fi

    warn "Nginx, PHP-FPM, Reverb, queue and NTRIP services still need production configuration."
    check_environment
}

setup_project() {
    require_project
    cd "$PROJECT_DIR"

    composer install

    if [[ -f package-lock.json ]]; then
        npm ci
    else
        npm install
    fi

    if [[ ! -f .env ]]; then
        cp .env.example .env
        warn ".env was created from .env.example"
    fi

    configure_env_postgres
    setup_postgres

    if ! grep -qE '^APP_KEY=base64:' .env; then
        php artisan key:generate
    fi

    php artisan optimize:clear
    php artisan migrate --force
    npm run build
    php artisan db:show --database=pgsql

    ok "Project setup completed with PostgreSQL"
}

clear_project() {
    require_project
    cd "$PROJECT_DIR"

    php artisan optimize:clear
    rm -rf public/build
    find storage/logs -type f -name '*.log' -delete 2>/dev/null || true
    ok "Generated project state cleared"
}

reset_database() {
    require_project
    cd "$PROJECT_DIR"

    warn "This permanently deletes all application tables and data in PostgreSQL."
    read -r -p "Type RESET to continue: " confirmation
    [[ "$confirmation" == "RESET" ]] || fail "Database reset cancelled"

    php artisan migrate:fresh --force
    ok "PostgreSQL database reset completed"
}

deploy_project() {
    require_project
    cd "$PROJECT_DIR"
    [[ -f .env ]] || fail ".env is missing"

    if grep -qE '^APP_DEBUG=true' .env; then
        warn "APP_DEBUG=true is enabled. Disable it for production."
    fi

    if ! grep -qE '^DB_CONNECTION="?pgsql"?$' .env; then
        fail "Production .env is not configured with DB_CONNECTION=pgsql"
    fi

    php artisan optimize:clear
    rm -rf public/build

    composer install \
        --no-dev \
        --prefer-dist \
        --no-interaction \
        --optimize-autoloader

    if [[ -f package-lock.json ]]; then
        npm ci
    else
        npm install
    fi

    npm run build

    php artisan db:show --database=pgsql
    php artisan migrate --force

    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan event:cache

    mkdir -p storage/framework/{cache,sessions,views} bootstrap/cache
    chmod -R ug+rwX storage bootstrap/cache

    ok "Deployment build completed with PostgreSQL"
    warn "Restart Nginx, PHP-FPM, Reverb, queue, observer and ntrip:serve separately."
}

show_help() {
    cat <<HELP
Usage:
  ./ntrip_project_postgresql.sh setup-env
  ./ntrip_project_postgresql.sh check
  ./ntrip_project_postgresql.sh setup-db
  ./ntrip_project_postgresql.sh configure-db
  ./ntrip_project_postgresql.sh setup-project
  ./ntrip_project_postgresql.sh clear
  ./ntrip_project_postgresql.sh reset-db
  ./ntrip_project_postgresql.sh deploy

Environment variables:
  PHP_VERSION=8.3
  NODE_MAJOR=22
  PROJECT_DIR=/absolute/path/to/ntrip_caster

  POSTGRES_HOST=127.0.0.1
  POSTGRES_PORT=5432
  POSTGRES_DB=ntrip_caster
  POSTGRES_USER=ntrip_app
  POSTGRES_PASSWORD=strong-secret-password

Examples:
  ./ntrip_project_postgresql.sh setup-env

  POSTGRES_DB=ntrip_caster \
  POSTGRES_USER=ntrip_app \
  POSTGRES_PASSWORD='replace-with-a-strong-password' \
    ./ntrip_project_postgresql.sh setup-db

  PROJECT_DIR=\$HOME/NTRIP/NTRIP_SERVER/ntrip_caster \
  POSTGRES_DB=ntrip_caster \
  POSTGRES_USER=ntrip_app \
  POSTGRES_PASSWORD='replace-with-a-strong-password' \
    ./ntrip_project_postgresql.sh setup-project

  PROJECT_DIR=/var/www/ntrip_caster \
    ./ntrip_project_postgresql.sh deploy
HELP
}

case "$COMMAND" in
    setup-env) setup_env ;;
    check) check_environment ;;
    setup-db) setup_postgres ;;
    configure-db) configure_env_postgres ;;
    setup-project) setup_project ;;
    clear) clear_project ;;
    reset-db) reset_database ;;
    deploy) deploy_project ;;
    help|--help|-h) show_help ;;
    *) fail "Unknown command: $COMMAND" ;;
esac
