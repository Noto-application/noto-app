import { applyHocuspocusReadOnly } from './hocuspocus-access';

/**
 * Unit флага записи Hocuspocus (#149), контракт из
 * docs/specs/108-collab-auth.spec.md, раздел «Запись на соединении Hocuspocus».
 *
 * Красные до реализации: модуля ./hocuspocus-access ещё нет.
 * onAuthenticate выставляет connection.readOnly до выдачи документа.
 * viewer остаётся в соединении и получает чужие правки; его update сервер
 * не применяет. editor и owner пишут.
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
