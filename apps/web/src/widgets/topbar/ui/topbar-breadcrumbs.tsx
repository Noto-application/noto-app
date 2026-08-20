import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';

export type BreadcrumbItem = {
  id: string;
  title: string;
};

type TopbarBreadcrumbsProps = {
  items: BreadcrumbItem[];
};

/**
 * Presentational: путь принимается через props, а не вычисляется здесь —
 * подъём от pageId к корню по parentId (buildPageTree) относится к FE-P1
 * (issue #53), не к этому виджету.
 *
 * v1 без обрезки: overflow-x: auto при переполнении (см. «Решения» в
 * web-app-shell.md).
 */
export function TopbarBreadcrumbs({ items }: TopbarBreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Путь до страницы" className="min-w-0 overflow-x-auto">
      <ol className="flex items-center gap-1 whitespace-nowrap text-body-compact">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={item.id}>
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              ) : null}
              <li className="min-w-0">
                {isLast ? (
                  <span className="text-foreground">{item.title}</span>
                ) : (
                  <Link
                    className="text-muted-foreground hover:text-foreground"
                    href={`/app/${item.id}`}
                  >
                    {item.title}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
