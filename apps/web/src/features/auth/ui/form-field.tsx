import type { InputHTMLAttributes, ReactNode } from 'react';

import { Input } from '@/src/shared/ui/input';

type FormFieldProps = Readonly<
  InputHTMLAttributes<HTMLInputElement> & {
    error?: string;
    label: string;
    trailing?: ReactNode;
  }
>;

export function FormField({ error, id, label, trailing, ...props }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label className="text-label font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          className={trailing ? 'pr-10' : undefined}
          {...props}
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className="text-label text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
