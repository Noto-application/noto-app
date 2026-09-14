import { describe, expect, it } from 'vitest';

import { deriveCollabUser } from './collab-user';

describe('deriveCollabUser', () => {
  it('имя берёт из email до @', () => {
    const user = deriveCollabUser({ id: 'u1', email: 'olya@example.com' });
    expect(user.name).toBe('olya');
  });

  it('цвет детерминирован по id и из палитры', () => {
    const a = deriveCollabUser({ id: 'user-a', email: 'a@x.io' });
    const again = deriveCollabUser({ id: 'user-a', email: 'a@x.io' });
    expect(a.color).toBe(again.color);
    expect(a.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('разные id — обычно разные цвета', () => {
    const a = deriveCollabUser({ id: 'user-a', email: 'a@x.io' });
    const b = deriveCollabUser({ id: 'user-z', email: 'b@x.io' });
    expect(a.color).not.toBe(b.color);
  });
});
