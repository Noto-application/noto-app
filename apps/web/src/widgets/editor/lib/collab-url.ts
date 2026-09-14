/**
 * WS-URL collab-сервера единым origin (#108): тот же хост, что и приложение,
 * схема ws/wss по протоколу страницы, путь `/collab`. Единый origin → HttpOnly
 * access-cookie уходит на хендшейк сама (Caddy проксирует `/collab` на collab).
 */
export function buildCollabUrl(origin: string): string {
  const url = new URL(origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/collab';
  url.search = '';
  url.hash = '';
  return url.toString();
}
