# Spec: Pages data layer

**Статус:** Draft  
**Дата:** 2026-08-25  
**Связанные:** [ADR-003](../../../../../docs/adr/003-authentication.md), [ADR-004](../../../../../docs/adr/004-data-fetching.md), [ADR-005](../../../../../docs/adr/005-state-management.md), [ADR-012](../../../../../docs/adr/012-api-contract.md), [ADR-013](../../../../../docs/adr/013-spec-driven-development.md), issue #53

## Цель

Дать frontend единый типизированный data-слой для чтения страниц проекта и
отдельной страницы через реальный API. Слой должен преобразовывать плоский
ответ списка в дерево, пригодное для сайдбара, хлебных крошек и выбора
родителя при перемещении страницы.

## Вне scope

- Рендеринг дерева, сайдбар, хлебные крошки и URL-навигация.
- Мутационные React-хуки, формы и UI создания, редактирования, перемещения или
  удаления страницы.
- Оптимистичные обновления и инвалидация query после мутаций.
- BlockNote/Yjs-редактор и хранение/синхронизация содержимого документа.
- Изменения API-контракта, backend-логики или ACL.

## Контракт

### Модель страницы

`Page` импортируется из `@noto/shared` и соответствует публичному DTO
контракта `pagesContract`:

```ts
type Page = {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  content: unknown[];
  position: number;
  createdAt: string;
  updatedAt: string;
};
```

Локальный тип с сокращённым набором полей не создаётся и не поддерживается.

### API-функции

Общий ts-rest `apiClient` расположен в `shared/api/client`; он отправляет
cookie с `credentials: 'include'` и единообразно обрабатывает `401` согласно
ADR-003. Новый HTTP-клиент не создаётся.

Адаптеры конкретного домена расположены в `entities/page/api/pages.ts` и
вызывают методы `apiClient.pages.*`. Они извлекают тела успешных ts-rest
ответов и не дублируют контракт или транспорт.

| Функция | ts-rest маршрут | Результат |
| --- | --- | --- |
| `getPagesList(projectId: string)` | `pages.list` (`GET /projects/:projectId/pages`) | `Promise<Page[]>` |
| `getPage(id: string)` | `pages.get` (`GET /pages/:pageId`) | `Promise<Page \| undefined>` |
| `createPage(projectId: string, input: CreatePageInput)` | `pages.create` | `Promise<Page>`; заготовка для последующей mutation |
| `updatePage(id: string, input: UpdatePageInput)` | `pages.update` | `Promise<Page>`; заготовка для последующей mutation |
| `deletePage(id: string)` | `pages.delete` | `Promise<void>`; заготовка для последующей mutation |

`getPagesList` возвращает массив из поля `{ pages }` успешного ответа. Пустой
проект — успешный результат `[]`.

`getPage` возвращает страницу из `{ page }`; `404 NOT_FOUND` маппится в
`undefined`. Остальные ошибки не маскируются и должны быть доступны TanStack
Query как ошибка запроса: адаптер преобразует их через
`toApiClientError(response.body)`. Это же преобразование применяется ко всем
неуспешным ответам `list`, `create`, `update` и `delete`.

Функции `createPage`, `updatePage` и `deletePage` не экспортируются из
публичного barrel-файла `entities/page` до задач мутаций. Они существуют как
внутренние типизированные заготовки для будущих feature-модулей.

`pageFixtures` и зависящий от него локальный API-слой удаляются; runtime-данные
страниц после этой задачи поступают только через `apiClient`.

### Query keys и read-only hooks

```ts
pageKeys.list(projectId)   // ['pages', 'list', projectId]
pageKeys.detail(id)        // ['pages', 'detail', id]

usePagesList(projectId)    // useQuery<Page[]>
usePage(id)                // useQuery<Page | null>
```

`usePagesList` использует `pageKeys.list(projectId)` и возвращает список
страниц текущего проекта. `usePage` использует `pageKeys.detail(id)` и
преобразует `undefined` из API-функции в `null`: TanStack Query не допускает
`undefined` как успешное значение query.

Имя `usePages` не является частью итогового публичного API entity. Внешние
потребители импортируют `usePagesList` и `usePage` из `entities/page`.

### Дерево страниц

`buildPageTree` принимает плоские данные:

```ts
type PageTreeSource = Pick<Page, 'id' | 'parentId' | 'position' | 'title'>;

type PageTreeNode = PageTreeSource & {
  children: PageTreeNode[];
};

function buildPageTree(pages: readonly PageTreeSource[]): PageTreeNode[];
```

- Страница с `parentId: null` — корневой узел.
- Страница с существующим `parentId` добавляется в `children` родителя.
- Корни и `children` упорядочены по возрастанию `position`; при одинаковой
  позиции сохраняется исходный порядок ответа API.
- Результат не мутирует входной массив и его элементы.
- Порядок элементов во входном плоском списке не влияет на корректность
  вложенности: родитель может находиться после ребёнка.

Некорректный список не маскируется: duplicate `id`, ссылка на отсутствующего
родителя (orphan) или цикл делают ответ API неконсистентным. `buildPageTree`
завершается ошибкой и не возвращает частичное дерево.

## Поведение

1. `usePagesList(projectId)` загружает плоский список через
   `apiClient.pages.list` и хранит server state в TanStack Query по ключу
   `pages.list(projectId)`.
2. Потребитель передаёт полученный список в `buildPageTree` и получает
   упорядоченные корневые узлы с рекурсивными `children`.
3. `usePage(id)` запрашивает страницу по `apiClient.pages.get`; для
   неизвестной или удалённой страницы hook успешно возвращает `null`.
4. Список и метаданные страниц используются последующими UI-задачами. Выбор
   текущей страницы и навигация остаются их ответственностью и не реализуются
   data-слоем.

## Крайние случаи

| Случай | Ожидаемое поведение |
| --- | --- |
| В проекте нет страниц | `getPagesList` и `usePagesList` успешно возвращают `[]`. |
| У страницы нет родителя | Узел находится среди корней. |
| Родитель расположен после ребёнка в ответе | Ребёнок всё равно вложен в этого родителя. |
| Равные `position` у siblings | Сохраняется порядок исходного API-ответа. |
| Duplicate `id`, orphan `parentId` или цикл | `buildPageTree` завершает работу ошибкой и не возвращает частичное дерево. |
| Запрошенная страница не существует или удалена | `getPage` возвращает `undefined`, `usePage` — `null`, без query error. |
| `401` | Общий API-клиент выполняет refresh; при неуспехе очищает сессию и перенаправляет на `/login`. |
| `403`, ошибка сети или другой API-ответ | Не преобразуется в пустые данные; query переходит в error state. |

## Взаимодействия

- `@noto/shared` — единственный источник типа `Page` и ts-rest-контракта.
- `shared/api/client` — единственный транспорт авторизованных запросов.
- TanStack Query хранит server state: список и метаданные страниц.
- URL хранит текущий `pageId`; data-слой не создаёт для него Zustand-store.
- Zustand может хранить только UI-состояние будущего дерева (например,
  раскрытые узлы), но не список/дерево страниц.
- `content` может прийти в DTO одной страницы, однако не становится источником
  правды редактора. Query-ответ допустимо использовать только как начальные
  данные для BlockNote; после инициализации редактор не читает и не записывает
  его содержимое через Query.

## Тесты

До реализации `buildPageTree` пишутся и проходят человеческое ревью unit-тесты
на следующие наблюдаемые сценарии:

- пустой список;
- корневые страницы, несколько уровней вложенности и родитель после ребёнка во
  входном массиве;
- сортировка корней и siblings по `position`, включая стабильный порядок при
  равных позициях;
- неизменность входного массива и объектов;
- отказ при duplicate `id`, orphan `parentId` и цикле.

После реализации обновляются тесты API-адаптеров и hooks: реальный клиент
мокается вместо фикстур, проверяются новые имена/keys, успешный пустой список,
`404 → undefined → null` и проброс остальных ошибок.
