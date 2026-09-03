# Spec: Editor

**Статус:** Draft
**Автор:** daria-z
**Дата:** 2026-08-30
**Связанные:** [ADR-008](../../../../../docs/adr/008-fsd-structure.md), [ADR-015](../../../../../docs/adr/015-rich-text-editor.md), issue #56 (рендер, автосохранение контента и заголовка, индикатор — все четыре среза)

## Цель

Пользователь видит сохранённый контент страницы через BlockNote и может его
редактировать, а также переименовать страницу — оба типа правок сохраняются
сами, без кнопки «Сохранить», и показывают статус сохранения.

## Вне scope

`viewer`/ACL (ждём `currentUserRole` от бэкенда, как и в остальных задачах
создания/редактирования), Yjs и collaborative editing (ADR-015: это
финальная архитектура, не MVP-срез — контент пока идёт через обычный
`PATCH`, не Yjs).

## Контракт

```tsx
// widgets/editor/ui/page-editor.tsx
export function PageEditor({ pageId, content }: { pageId: string; content: Page['content'] }): ReactNode;

// widgets/editor/ui/page-title.tsx
export function PageTitle({ pageId, projectId, title }: { pageId: string; projectId: string; title: string }): ReactNode;

// widgets/editor/ui/autosave-indicator.tsx
export function AutosaveIndicator({ status, onRetry }: { status: AutosaveStatus; onRetry: () => void }): ReactNode;

// widgets/editor/model/use-page-autosave.ts
export function usePageAutosave(pageId: string): {
  onChange: (content: Page['content']) => void;
  status: AutosaveStatus; // 'idle' | 'saving' | 'saved' | 'error'
  retry: () => void;
};

// widgets/editor/model/use-page-title-autosave.ts
export function usePageTitleAutosave(pageId: string, projectId: string): { onChange: (title: string) => void };
```

`content` — как приходит с бэка: `unknown[]` (`pageContentSchema`, бэк не
валидирует структуру блоков). Компонент сам приводит его к `PartialBlock[]`
на входе в BlockNote.

## Поведение

**Контент**

1. `content.length > 0` → `initialContent` = сам `content` (as `PartialBlock[]`).
2. `content.length === 0` (новая страница, `content` ещё не сохранялся) →
   `initialContent` не передаём, BlockNote создаёт документ с одним пустым
   блоком сам.
3. Каждое изменение в редакторе (`BlockNoteView.onChange`) отдаёт
   `editor.document` в `usePageAutosave.onChange`.
4. Хук копит изменения `AUTOSAVE_DEBOUNCE_MS` (1000мс) и шлёт один `PATCH
   /pages/:id` с последней версией — частые правки не долбят API на каждое
   нажатие клавиши.
5. При размонтировании (уход со страницы) отложенное изменение сохраняется
   сразу, а не теряется — иначе последняя правка перед уходом пропадала бы.
6. `<PageEditor key={page.id} .../>` — при смене `pageId` в URL компонент
   размонтируется и создаётся заново вместе с инстансом BlockNote
   (ADR-005: «При смене `[pageId]` — unmount/remount редактора»). Без
   `key` React переиспользовал бы тот же инстанс между разными страницами
   маршрута, и правка одной страницы могла бы уйти `PATCH`-ом на другую.
7. `status` (idle/saving/saved/error) отражает состояние мутации напрямую,
   без отдельного стейта; `retry()` повторно шлёт последний контент из
   `mutation.variables`, но только пока `status === 'error'`.
8. Ошибка автосохранения (сеть, `403`, `400`, `500`) уходит в
   `console.error` и показывается через `AutosaveIndicator` с кнопкой
   «Повторить».

**Заголовок**

9. `PageTitle` — всегда `<input>`, без переключения вид/редактирование
   (Notion-style, без отдельного стейта режима).
10. `usePageTitleAutosave` — та же debounce-модель, тот же
    `AUTOSAVE_DEBOUNCE_MS`.
11. Пустой (или из одних пробелов) заголовок не отправляется вовсе — не
    ошибка, обычное промежуточное состояние при наборе (select-all +
    delete); уже запланированная отправка предыдущего значения при этом
    отменяется, а не долетает до сервера с опозданием.
12. Заголовок триммится на клиенте перед отправкой (сервер тоже триммит —
    это подстраховка, а не дублирование логики валидации).
13. Отдельного индикатора у заголовка нет — на страницу один
    `AutosaveIndicator` (у контента); ошибка сохранения заголовка тихо
    уходит в `console.error`. Два независимых индикатора могли бы
    одновременно показывать разное и не давали бы понять, к чему какой
    относится.
14. После успешного сохранения заголовка инвалидируется
    `pageKeys.list(projectId)` — иначе дерево страниц в сайдбаре не узнаёт
    о переименовании до случайного стороннего рефетча.

## Крайние случаи

`content` не проходит как валидные `PartialBlock[]` (рассинхрон с тем, что
когда-то сохранил другой клиент) — не обрабатываем в этом срезе: страница
одного пользователя, чужого контента здесь ещё нет. Если BlockNote бросит
на старте — вернёмся с крайним случаем предметно, не гадаем заранее
(нет error boundary вокруг `PageEditor` — известный follow-up).

Два последовательных `PATCH` **по одному и тому же полю** в полёте
одновременно (медленная сеть, второй debounce успел сработать раньше
ответа на первый) — порядок ответов сервера не гарантирован, более старый
может прийти позже более нового. Не решаем в этом срезе: страница одного
пользователя, повторный клиент маловероятен; если проявится на практике —
нужна отмена предыдущего запроса (`AbortController`) или версия/`updatedAt`
в проверке.

Конкурентные `PATCH` по **разным** полям (content и title одновременно) —
на бэке не конфликтуют (`applyContentUpdate` собирает `data` только из
реально переданных полей), а в detail-кэше не бьются, потому что
`onSuccess` каждого хука мержит в кэш только своё поле, а не весь объект
страницы — иначе более старый по сетевому ответу `PATCH` одного поля мог
бы откатить в кэше поле, только что сохранённое другим хуком.

## Взаимодействия

Состояние — по матрице [ADR-005](../../../../../docs/adr/005-state-management.md):
`content`/`title` вычитаны через `usePage` (TanStack Query) и переданы
пропсом при монтировании; автосохранение — тоже TanStack Query, отдельная
мутация в каждом из `usePageAutosave`/`usePageTitleAutosave` (зачем каждая
мержит своё поле в `pageKeys.detail(pageId)` при успехе — см. «Крайние
случаи»). На уже смонтированный `PageEditor`/`PageTitle` это не влияет: они
не перечитывают `usePage` после монтирования — контент во время
редактирования живёт внутри инстанса BlockNote, заголовок — в локальном
`useState` инпута; во внешний мир значения выходят только через `onChange`
в момент отправки.

## Открытые вопросы

Нет — принятые как follow-up, не блокирующий этот срез: error boundary
вокруг `PageEditor`, автовозврат `AutosaveIndicator` из `saved` в `idle`
через паузу.
