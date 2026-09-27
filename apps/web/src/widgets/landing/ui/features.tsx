import type { ReactNode } from 'react';

import { cn } from '@/src/shared/lib/utils';

import { MockTodo, MockTreeItem } from './app-preview';

type FeatureCardProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  /** Макет прижимается к нижнему краю карточки и обрезается им. */
  children: ReactNode;
  className?: string;
}>;

function FeatureCard({ eyebrow, title, description, children, className }: FeatureCardProps) {
  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl bg-surface px-6 pt-6 sm:px-8 sm:pt-8',
        className,
      )}
    >
      <p className="text-body text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-1 text-heading-1">{title}</h3>
      <p className="mt-2 max-w-md text-body-lg text-muted-foreground">{description}</p>
      <div
        aria-hidden="true"
        className="mt-8 flex-1 rounded-t-lg border border-b-0 bg-background p-5 text-body-lg shadow-sm"
      >
        {children}
      </div>
    </article>
  );
}

export function Features() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FeatureCard
        eyebrow="Редактор"
        title="Пишите блоками."
        description="Заголовки, списки и задачи. Наберите «/» и выберите блок — без панелей инструментов."
        className="min-h-96"
      >
        <div className="text-heading-1">Созвон по релизу</div>
        <p className="mt-2 mb-3">Решили выкатить в четверг.</p>
        <MockTodo done>Собрать changelog</MockTodo>
        <MockTodo>Предупредить поддержку</MockTodo>
        <div className="mt-3 flex items-start gap-2 text-muted-foreground">
          <span>/</span>
          <div className="w-48 rounded-lg border bg-background p-1 text-body shadow-md">
            <div className="rounded-sm bg-surface-hover px-2 py-1.5 text-foreground">Заголовок</div>
            <div className="px-2 py-1.5 text-foreground">Задача</div>
            <div className="px-2 py-1.5 text-foreground">Список</div>
          </div>
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Синхронизация"
        title="Правки сразу везде."
        description="Изменения сохраняются сами и мгновенно появляются в других вкладках и на других устройствах."
        className="min-h-96"
      >
        <div className="grid gap-3">
          {[
            { device: 'Ноутбук', typing: true },
            { device: 'Телефон', typing: false },
          ].map(({ device, typing }) => (
            <div key={device} className="rounded-lg border p-3">
              <div className="mb-1.5 text-label text-muted-foreground">{device}</div>
              <span>
                Решили выкатить в четверг
                {typing && (
                  <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-primary" />
                )}
              </span>
            </div>
          ))}
          <p className="text-body text-muted-foreground">Кнопки «Сохранить» нет — она не нужна.</p>
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Структура"
        title="Страницы внутри страниц."
        description="Проект — папка верхнего уровня. Внутри — страницы любой глубины, их легко перетаскивать."
      >
        <div className="text-body">
          <MockTreeItem expanded>Диплом</MockTreeItem>
          <MockTreeItem depth={1} expanded>
            Глава 1
          </MockTreeItem>
          <MockTreeItem depth={2} leaf active>
            Источники
          </MockTreeItem>
          <MockTreeItem depth={1} leaf>
            Глава 2
          </MockTreeItem>
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Ссылки"
        title="У каждой страницы свой адрес."
        description="Скопировали ссылку — отправили коллеге. Откроется ровно та страница, а не главная."
      >
        <code className="inline-block rounded-md bg-muted px-2.5 py-1.5 font-mono text-code break-all">
          noto.app/app/k7f2m9q1
        </code>
      </FeatureCard>
    </div>
  );
}
