function findCookie(name: string): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const prefix = `${name}=`;

    const cookie = document.cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(prefix));

    return cookie === undefined
        ? null
        : decodeURIComponent(cookie.slice(prefix.length));
}

/**
 * Tạo header chuẩn cho các request gọi Laravel API.
 *
 * @param hasBody true khi request gửi JSON body.
 */
export function createApiHeaders(hasBody = false): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (hasBody) {
        headers['Content-Type'] = 'application/json';
    }

    if (typeof document === 'undefined') {
        return headers;
    }

    const csrfToken = document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content');

    if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken;
    }

    const xsrfToken = findCookie('XSRF-TOKEN');

    if (xsrfToken) {
        headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    return headers;
}
