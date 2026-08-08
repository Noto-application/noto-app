import { authCredentialsSchema } from '@noto/shared';

describe('authCredentialsSchema', () => {
  it('нормализует email: trim + lowercase', () => {
    const result = authCredentialsSchema.safeParse({
      email: '  User@Example.COM  ',
      password: 'password123',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('отклоняет пароль короче минимума', () => {
    const result = authCredentialsSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('отклоняет некорректный email', () => {
    const result = authCredentialsSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(result.success).toBe(false);
  });
});
