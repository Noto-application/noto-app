import {
  USERNAME_MAX_LENGTH,
  updateUserSchema,
  usernameSchema,
} from '@noto/shared';

describe('usernameSchema', () => {
  it('обрезает пробелы по краям', () => {
    const result = usernameSchema.safeParse('  Alex  ');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Alex');
    }
  });

  it('сохраняет регистр и внутренние пробелы', () => {
    const result = usernameSchema.safeParse('Ivan Petrov');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Ivan Petrov');
    }
  });

  it('принимает имя ровно в максимум символов', () => {
    const result = usernameSchema.safeParse('x'.repeat(USERNAME_MAX_LENGTH));

    expect(result.success).toBe(true);
  });

  it('отклоняет пустую строку', () => {
    expect(usernameSchema.safeParse('').success).toBe(false);
  });

  it('отклоняет одни пробелы (после trim пусто)', () => {
    expect(usernameSchema.safeParse('   ').success).toBe(false);
  });

  it('отклоняет имя длиннее максимума', () => {
    expect(usernameSchema.safeParse('x'.repeat(USERNAME_MAX_LENGTH + 1)).success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('принимает валидный username', () => {
    const result = updateUserSchema.safeParse({ username: 'Alex' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('Alex');
    }
  });

  it('отклоняет тело без username', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
  });

  it('отклоняет username не-строкой', () => {
    expect(updateUserSchema.safeParse({ username: 1 }).success).toBe(false);
  });
});
