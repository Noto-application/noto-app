const SESSION_COOKIES = ['access_token', 'refresh_token'] as const;

interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/**
 * Есть ли у запроса auth-cookie — без обращения к API.
 *
 * Только для выбора CTA на публичных страницах (#143): cookie может оказаться
 * протухшей, но тогда `/app` всё равно проверит сессию в proxy и отправит на
 * `/login`. Для решений о доступе не использовать.
 */
export function hasSessionCookie(cookies: CookieReader): boolean {
  return SESSION_COOKIES.some((name) => Boolean(cookies.get(name)?.value));
}
