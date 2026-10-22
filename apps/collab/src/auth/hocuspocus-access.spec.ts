import { applyHocuspocusReadOnly } from './hocuspocus-access';

/**
 * Изолированный unit setter-функции connection.readOnly (#149), контракт из
 * collab-auth.spec.md. Не проверяет вызов setter в production onAuthenticate.
 *
 * Красные до реализации: модуля ./hocuspocus-access ещё нет.
 * Live WS-сценарий отдельно обязателен: viewer получает sync/live updates, но
 * не пишет; editor/owner могут писать. Unit этого не доказывает.
 */

describe('applyHocuspocusReadOnly', () => {
  it('viewer → readOnly, остальные поля соединения не трогаем', () => {
    const connection = { readOnly: false, requiresAuthentication: true, isAuthenticated: true };

    applyHocuspocusReadOnly(connection, true);

    expect(connection).toEqual({
      readOnly: true,
      requiresAuthentication: true,
      isAuthenticated: true,
    });
  });

  it('editor/owner (readOnly false) → запись разрешена, соединение не рвём', () => {
    const connection = { readOnly: true, requiresAuthentication: true, isAuthenticated: false };

    applyHocuspocusReadOnly(connection, false);

    expect(connection).toEqual({
      readOnly: false,
      requiresAuthentication: true,
      isAuthenticated: false,
    });
  });
});
