import { ApiClientError } from '@/src/shared/api';

type AuthFormError = Readonly<{
  field?: 'email';
  message: string;
}>;

export function getAuthFormError(error: unknown): AuthFormError {
  if (!(error instanceof ApiClientError)) {
    return { message: 'Не удалось выполнить запрос. Попробуйте ещё раз.' };
  }

  switch (error.code) {
    case 'EMAIL_TAKEN':
      return { field: 'email', message: 'Этот email уже зарегистрирован.' };
    case 'INVALID_CREDENTIALS':
      return { message: 'Проверьте email и пароль.' };
    case 'UNAUTHORIZED':
      return { message: 'Сессия истекла. Войдите снова.' };
    case 'VALIDATION_ERROR':
      return { message: 'Проверьте корректность email и пароля.' };
    default:
      return { message: 'Не удалось выполнить запрос. Попробуйте ещё раз.' };
  }
}
