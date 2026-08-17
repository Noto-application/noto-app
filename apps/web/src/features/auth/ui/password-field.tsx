'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

import { FormField } from './form-field';

type PasswordFieldProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    error?: string;
    label?: string;
  }
>;

export function PasswordField({ error, label = 'Пароль', ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      {...props}
      error={error}
      label={label}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
          aria-pressed={visible}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}
