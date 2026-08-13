import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/src/shared/lib/utils';

/**
 * Пустое состояние списка/страницы (Figma «NoTo» → Components → Skeleton /
 * Loading → Empty states, узел 1:2237). Кнопка в макете пиксель-в-пиксель
 * совпадает с `Button size="sm" variant="secondary"` — переиспользуется
 * через слот `action`, а не задизайнена заново.
 *
 * `icon` — узел в макете содержит эмодзи-плейсхолдер, не экспортированный
 * ассет; принимает произвольный `ReactNode` (обычно иконку `lucide-react`),
 * чтобы каждое пустое состояние подбирало смысловую иконку само.
 *
 * `title` переопределяет нативный HTML-атрибут `title` (строка-тултип) —
 * здесь это заголовок пустого состояния, поэтому исходный тип исключён
 * через `Omit`.
 *
 * Импорт типов напрямую (`ComponentProps`/`ReactNode`), а не через
 * `React.ComponentProps` — с namespace-формой Storybook Controls рисовал
 * "ReactReactNode" в описании (баг react-docgen-typescript). Единственный
 * файл в UI-kit с таким стилем импорта — намеренно, не рассинхрон.
 */
interface EmptyStateProps extends Omit<ComponentProps<'div'>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

function EmptyState({ className, icon, title, description, action, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-10 text-center',
        className,
      )}
      {...props}
    >
      {icon ? <div className="mb-3 text-muted-foreground [&_svg]:size-9">{icon}</div> : null}
      <p data-slot="empty-state-title" className="text-heading-3 text-foreground">
        {title}
      </p>
      {description ? (
        <p data-slot="empty-state-description" className="mt-1.5 max-w-60 text-body-compact text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
