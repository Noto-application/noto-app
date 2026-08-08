/** Парсит TTL вида `15m`, `7d` в секунды (для Redis EX). */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Некорректный JWT TTL: ${ttl}`);
  }

  const value = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';

  const multipliers: Record<'s' | 'm' | 'h' | 'd', number> = {
    s: 1,
    m: 60,
    h: 3_600,
    d: 86_400,
  };

  return value * multipliers[unit];
}
