# Спайк #133: FullCalendar Standard + BlockNote

Статус на 2026-10-31: **исследовательский spike #133 принят человеком с
зафиксированными ограничениями**. Выбраны FullCalendar Standard
`@fullcalendar/react@7.1.3` и `temporal-polyfill@1.0.1`.
Подтверждение пользователя дословно: «Принимаю результат spike #133 и выбор FullCalendar с зафиксированными ограничениями.»
Независимый CODE review Claude узкого REST-fix — APPROVE.
Внешние браузерные результаты и границы каждого PASS
указаны ниже; browser timezone/DST и touch остаются UNVERIFIED из-за возможностей
инструментов. #133 не объявлена закрытой. Это эксперимент внешней интеграции по
ADR-013, не реализация #135–#139; #135 не начата.

## Версии и лицензии

Установлены строго `@fullcalendar/react@7.1.3` и `temporal-polyfill@1.0.1`.
Окружение: Next `16.2.11`, React/React DOM `19.2.8`, BlockNote core/react/mantine
`0.54.0`, Yjs `13.6.32`. Другие версии в lockfile не обновлялись.

Новые пакеты (метаданные подтверждены `pnpm view <package>@<version> license`):

| Пакет                        | Версия | Лицензия   |
| ---------------------------- | ------ | ---------- |
| `@fullcalendar/react`        | 7.1.3  | MIT        |
| `@fullcalendar/core`         | 7.1.3  | MIT        |
| `@full-ui/headless-calendar` | 7.1.3  | MIT        |
| `temporal-polyfill`          | 1.0.1  | MIT        |
| `temporal-spec`              | 1.0.0  | Apache-2.0 |
| `temporal-utils`             | 1.0.1  | MIT        |

Уточнение оркестратора: ограничение касается FullCalendar Standard без Premium,
а не требования MIT для всего дерева зависимостей. Транзитивная зависимость
`temporal-spec` использует Apache-2.0. Premium/Scheduler не подключены.
Существующий BlockNote имеет MPL-2.0. Upstream license notices в пакетах
не изменялись и не удалялись; при распространении необходимо сохранять
применимые LICENSE/NOTICE и copyright notices. Эта таблица — не юридический аудит.

Документация v7: <https://fullcalendar.io/docs/react>. Используются entrypoints
`@fullcalendar/react/daygrid`, `/interaction`, `/locales/ru`, `/themes/classic`;
явно импортированы skeleton/theme CSS. Палитра адаптирована к существующим
Noto CSS-токенам, без глобального Temporal polyfill и без CSS-палитры с `:root`.

## Предложение архитектуры, не принятый ADR

- `shared/ui/calendar/month-grid` — нейтральный UI-адаптер: `id/date/label`,
  внешний месяц, dateClick/itemClick и фактический `[from, to)`. Нет доменного DTO,
  API, Query, URL, прав и мутаций. Локальные даты форматируются через локальные
  календарные поля, не через `toISOString().slice(...)`.
- `widgets/editor/spike/calendar-schema` — одно экспериментальное определение
  `calendar`, `propSchema: {}`, `content: 'none'`, плюс defaultBlockSpecs. JSON
  editable/readonly и `withCollaboration` стенда используют **один объект схемы**.
  В пропсах нет проекта, месяца, карточек, заголовков или query-кэша.
- Runtime-контекст стенда содержит **синтетическую** содержащую Page и карточки.
  Каждый блок хранит свой месяц в React state. Для воспроизводимости начальный
  месяц зафиксирован на `2026-03`. Без контекста — статический inert placeholder.
  В локальных fixtures нет fetch. В отдельном real-transport режиме проект
  берётся из настоящего GET Page; карточки всё равно SYNTHETIC, не календарный API.
- Схема использует `React.lazy`/`Suspense` для адаптера: регистрация схемы сама
  по себе не импортирует FullCalendar. Это выбранное направление для #137:
  документ без calendar-блока не должен грузить календарь. Верхняя демонстрационная
  сетка самого стенда импортирует адаптер eagerly, поэтому стенд целиком не является
  измерением lazy-load документа. `Temporal` импортируется eagerly в
  `calendar-schema.tsx:6`, там же находятся MonthControls; lazy только grid
  (`:10–13`). Верхний grid импортируется eagerly в `calendar-spike.tsx:13`.
  Production-схема ещё не подключена. Для будущей production-интеграции lazy grid
  уместен, но проверять его нужно на отдельном экране/документе без eager верхней
  сетки; отсутствие реальной сетевой загрузки здесь не доказано.
- При production-интеграции data/query остаются в `entities/calendar-entry`,
  мутации — в features, композиция — выше. Editor не импортирует календарный
  widget. В #137 понадобится прокинуть проект настоящей Page из маршрута и
  согласованно подключить общую схему в оба REST creator и collab creator.
  Сейчас эти три production creator **не изменены**: спайк не включает production
  slash menu и не делает старый редактор способным читать экспериментальный блок.
- `/dev/calendar-spike` доступен только при `NODE_ENV === 'development'`.
  В production серверный guard вызывает `notFound()` **до** импорта стенда;
  build также выполняет guard. Ссылок в навигации нет. Guard не гарантирует
  отсутствие экспериментальных client chunks в артефакте сборки.
- Создание BlockNote требует `window`: entry использует существующий в проекте
  паттерн `next/dynamic` с `ssr: false`. Первый HTTP smoke выявил 500 при SSR;
  после client-only wrapper dev HTTP smoke возвращает 200. Это не hydration check.

### Экспорт и clipboard

`toExternalHTML` задан явно и всегда возвращает `[Calendar unavailable]`, а не
живой render. Проверены HTML и Markdown экспортёры; последний используется
BlockNote 0.54 для `text/plain` при копировании блока.

В установленном upstream `src/api/clipboard/toClipboard/copyExtension.ts`
различаются `blocknote/html`, `text/html`, `text/plain`. Но это **форматы, а не
доверенная граница**: `fromClipboard/pasteExtension.ts` принимает переданный
`blocknote/html` и вызывает `pasteHTML(data, true)` без аутентификации источника.
Следовательно, нельзя выводить проект/права из MIME. Реальный проект должен
резолвиться только из целевой Page с серверным ACL; неподдерживаемый/публичный
контекст должен оставаться inert.

Отдельный путь: upstream отдаёт native copy выделению внутри non-editable island.
Поэтому блок перехватывает `copy` внутри календаря и записывает только безопасный
HTML/text placeholder. Помимо синтетического copy event в jsdom, получен внешний
отчёт нативного clipboard в Chrome Incognito (см. ниже). Копирование целого блока
остаётся механизмом BlockNote. Его internal HTML serializer/parser сохраняют тип
и пустые props в автоматическом тесте; JSON бизнес-пропсов после нативной вставки,
реальный межпроектный ACL и Safari не проверены. Не выдаём синтетические Page A/B
за настоящие серверные проекты или JSON remount за нативный clipboard.

## Воспроизведение

Из корня: `pnpm --filter @noto/web dev`, открыть
`http://localhost:3000/dev/calendar-spike?month=2026-03`.
Backend, аккаунт и БД не нужны. Все карточки помечены `SYNTHETIC`.

1. Верхняя сетка: ru, понедельник, соседние даты; диапазон должен быть
   `[2026-02-23, 2026-04-06)` (42 календарных дня). Нажать день/карточку —
   диагностическая строка, не создание/переход к настоящей Page.
2. Previous/Next/Today меняют `month` через `router.push`; проверить back/forward
   без скачков или цикла. Например, апрель: `[2026-03-30, 2026-05-04)`.
3. Переключить Dark и Narrow (320px), проверить полную ширину, длинную карточку,
   фокус клавиатурой, клик/touch без случайной правки или drag документа.
4. В JSON editable изменить месяц только первого из двух блоков: второй месяц
   и `Document changes` не должны меняться. Сериализовать в readonly Page B:
   там только fixture B, не A. Просмотреть external HTML/Markdown — placeholder.
5. В Local Yjs вставить два блока, дождаться обновления счётчика. Изменять месяцы:
   счётчик не должен расти. Remount binding сохраняет документ в том же Y.Doc,
   но локальные месяцы сбрасываются. Это не перезапуск сервера/БД.
6. В Page B снять `Destination readonly`, скопировать туда целый блок A,
   затем вернуть readonly. Скопировать блок наружу в HTML/text
   редактор. Проверить отсутствие проекта/заголовков, native selection внутри
   карточек, вставку в контекст без Provider. Последний всегда inert.
7. Повторить в браузерных timezone `America/Los_Angeles` и `Europe/Berlin` на
   мартовских DST-датах. Открыть DevTools: hydration/runtime errors и Network.
   Не должно быть запросов календарного API от стенда.

### Реальный REST / Hocuspocus: только после согласования окружения и fixture-записей

`calendar-real-roundtrip.tsx` добавляет opt-in transport, не production #137.
Локальный агент-реализатор не создавал fixtures и не выполнял PATCH/WS подключения.
Исторический smoke с недоступным `localhost:8080` (curl 000) предшествовал внешней
приёмке; он не описывает текущее состояние окружения. Внешний оператор позднее
проверил реальные fixtures, REST и collab, включая согласованный graceful restart
(свидетельства ниже). Текущий статус процессов здесь не проверяется.
Без подтверждения оператора не запускать/перезапускать сервисы и не создавать данные.

После подтверждения:

1. Использовать утверждённый **development** web/API/collab origin
   `http://localhost:8080`, войти обычным аккаунтом. `NEXT_PUBLIC_API_URL` существующего
   окружения должен указывать на тот же origin; стенд блокирует иной API origin,
   не меняет CORS/cookie-конфигурацию и не использует внутренние endpoints/secrets.
2. В disposable проекте редактора/владельца создать **две разные** Page через
   существующий `POST /api/projects/<projectId>/pages`, с обычной HttpOnly сессией:
   тела `{"title":"CALENDAR-SPIKE-133 REST","content":[]}` и
   `{"title":"CALENDAR-SPIKE-133 COLLAB","content":[]}`. Это инструкции оператору,
   не автоматически исполняемый код. Сохранить ID из ответов. **Не открывать**
   эти Page в production-редакторе: пустая REST Page может сразу стать collab,
   а production-схема не знает экспериментального блока.
3. Открыть `/dev/calendar-spike?restPageId=<id1>&collabPageId=<id2>&month=2026-03`.
   Выбор ID делает только GET. Проверить отображённые ID/проект/роль/mode.
   Маркеры заголовка проверяются повторным независимым GET перед записью/WS.
   Это предохранитель для disposable данных, не серверный ACL или CAS.
4. REST: подтвердить disposable checkbox, нажать Enable, затем Insert diagnostic
   blocks locally. PATCH выполняется **только** отдельной явно названной кнопкой:
   существующий `updatePage` → независимый `cache: 'no-store'` GET → remount
   readonly и editable views. Ожидать `content match: true`, `mode: rest` и две
   сетки в readonly snapshot. Disable, перезагрузить URL и повторить независимый
   GET без PATCH. В Network записать порядок и ответы; не подменять GET ответом PATCH.
5. COLLAB: никогда не использовать заполненную REST fixture из шага 4. Перед
   **первым Connect** подтвердить promotion пустой `rest/content: []` fixture.
   Стенд отказывает populated REST и viewer promotion; существующую collab Page
   viewer может открыть readonly. Provider использует same-origin `/collab`,
   `token: 'cookie-auth'`, fragment `document-store`. BlockNote не создаётся до
   первого успешного sync; initialContent в WS binding не передаётся.
6. После sync вставить диагностические блоки явной кнопкой. Изменять месяц одного
   блока: второй месяц и счётчик Yjs updates не должны меняться. Дождаться
   `unacknowledged changes: 0`, Disconnect, снова подтвердить Connect/reopen:
   создаются **новые** provider и Y.Doc, GET должен показать `editorMode: collab`,
   документ должен загрузиться с сервера. Нулевой pending/synced — не DB durability.
7. Для доказательства персистентности запросить отдельное разрешение на restart
   collab-сервиса после подтверждённого сохранения. Затем повторить новый Connect
   и GET, записать режим, блоки и фактические restart/времена. До этого durable
   restart остаётся UNVERIFIED, даже если обычный reconnect сохранил данные.
8. Viewer-проверку выполнить отдельной реальной viewer-сессией на этих fixtures:
   REST только readonly, collab readonly до/после sync, без Insert/PATCH. Права
   берутся из GET Page; fake viewer checkbox локального стенда не является ACL-тестом.

REST намеренно использует ручной `updatePage`, не `usePageAutosave`: существующий
хук flush-ит pending запись при unmount и не предоставляет awaitable flush.
Здесь нужны строгий opt-in и наблюдаемый PATCH → fresh GET, без фоновой записи
при навигации. QueryProvider/usePage и существующие collab URL/status helpers
переиспользованы; content не дублируется в отдельный Query/Zustand store сверх
существующего Page detail, локальное редактирование — только BlockNote/Yjs.

Сравнение REST исправлено после двух регрессий: JSONB меняет порядок ключей,
а BlockNote для `content: 'none'` возвращает перечислимое `content: undefined`,
которое JSON-транспорт опускает. До первого `await` создаётся один JSON-снимок;
именно он отправляется в PATCH и сравнивается с независимым GET через
`replaceEqualDeep`, без мутации редактора и без сортировки массивов. Пять
transport-регрессий прошли человеческое и независимое TEST review; текущие
11 wiring-тестов и полный набор 262 тестов GREEN. Независимый CODE review — APPROVE.

### Внешний CODE review Claude, передано пользователем

Финальное ревью ограничено `calendar-real-roundtrip.tsx` и его тестами при
HEAD `8639465`: оба untracked-файла прочитаны из рабочего дерева, установленный
исходник зависимости проверен на месте. Reviewer ничего не запускал. Вердикт —
**APPROVE**, HIGH-замечаний нет. Подтверждены snapshot до первого `await`, тот же
snapshot в PATCH, независимый свежий GET, отсутствие мутации входного документа
и семантика структурного сравнения (ключи объектов неупорядочены, массивы упорядочены).
Это одобрение узкого исправления, не всей production-интеграции календаря.

Два LOW follow-up не блокируют одобрение и в этом проходе не исправляются:

- Проверки identity около строк 207–208 теста сравнивают `submitted` с копией,
  созданной внутри mock, поэтому тавтологичны; предложено проверять исходный
  `body.content` относительно `submitted`.
- Нет race-теста, который упал бы при переносе snapshot после первого `await`.
  Текущий код корректен по чтению, но этот порядок не защищён отдельной регрессией.

Для runtime-протокола записать OS, браузер/версию, viewport, timezone, fixture ID,
фактические действия и результат каждого шага; удалить cookies/tokens из HAR.
Общее «базовые сценарии работают» само по себе не переводит granular строки в
PASS. Следующие результаты ограничены конкретными переданными действиями.

### Внешняя браузерная приёмка Codex, передано пользователем

Источник — отчёты и переданные пользователем скриншоты за 2026-10-30/31, не
самостоятельный запуск или повторная проверка агентом-автором этого документа.
Указана macOS 27.0.1 arm64; браузер/версия первоначальных проверок не зафиксированы,
для clipboard явно указан Chrome Incognito (версия не передана). Desktop-снимок
ограничен шириной 1280px; дополнительный узкий прогон выполнен при viewport
1280×720 и Narrow DOM 320px. Сырые HAR/Network events и clipboard MIME не доступны.

Disposable fixtures: проект `a79a665b-4a03-4836-819c-8a56daf46644`,
REST `f5a240b2-0db5-498e-abae-a951f39555b4`,
COLLAB `8fa7ac7e-d9ed-4a66-8753-c6d4cec81b6c`.

- **REST — PASS на уровне UI + независимого GET/reload:** после исправления
  повторный PATCH показал `content match: true`, `mode: rest`. Текстовый маркер
  `— REST fix verified 2026-10-31` и два calendar-блока сохранились после свежего
  GET и reload. Месяц первого блока April, второго March; переключение месяца
  не меняло server content и `updatedAt` (`2026-10-30T21:38:48.829Z`). Ошибок и
  предупреждений браузера в этом повторе не наблюдалось. Порядок запросов именно
  в Network остаётся UNVERIFIED; он отдельно проверяется wiring-тестами.
- **COLLAB — PASS для проверенных сценариев:** promotion пустой REST fixture,
  обмен текстом `PEER133` между двумя peers, независимые локальные месяцы,
  отсутствие роста счётчиков Yjs при смене месяца (17/1, pending 0), Disconnect
  и reconnect с новыми Y.Doc. После отдельно согласованного graceful SIGTERM
  restart 2026-10-30 в 22:21:46 Tbilisi сохранённый документ/маркер загрузился
  новым клиентом. Это свидетельство сохранения через штатное завершение, не
  crash recovery; ACK сам по себе не доказывает запись в БД. Статус старого
  watcher/процессов сейчас не проверялся и не менялся.
- **Предупреждения:** на старом lifecycle периодически появлялось Hocuspocus
  `An authentication token is required… Won’t try again.` при успешном sync;
  новый клиент после restart был чистым. Причина UNKNOWN, исправление не заявлено.
  Предупреждение ProseMirror о selection не повторилось на переданных UI-действиях;
  это не доказательство исправления для любых документов.
- **UX — PASS в проверенном окружении:** back/forward, ru/Monday и мартовский/
  апрельский диапазоны, light/dark, Narrow 320px (`scrollWidth: 318`), обрезка
  длинного заголовка, Tab/Shift+Tab и возврат фокуса в текст, undo текста без
  изменения месяца, mouse date/card click. Ошибок на этих действиях не отмечено.
  Дополнительные результаты focus/drag/readonly приведены ниже.
- **Узкий readonly/drag прогон — PASS для наблюдённых действий:** в Narrow после
  Next/Previous фокус возвращался в paragraph, ввод символа работал. Обычный drag
  за handle (`draggable: true`) переместил calendar перед paragraph. Next/Previous,
  клик по карточке и mouse drag внутри календаря не меняли порядок блоков или
  счётчик документа — случайный drag не наблюдался. В readonly ввод и нативная
  вставка не изменили документ: 3 блока, `Document changes: 0`; положительный
  контроль вставки в editable работал. Локальная навигация readonly сохранила
  независимость месяцев: первый April, второй March. Без контекста видны два
  placeholder, без таблиц и контролов; нативная вставка туда не выполнялась.
  Ошибок/предупреждений приложения в этом прогоне не наблюдалось. Два предупреждения
  Chrome DevTools о защите вставки относятся к диагностическим попыткам, не к
  runtime приложения. REST, collab и прежний clipboard-набор заново не повторялись;
  по отчёту файлы не редактировались.
- **Browser timezone/DST и touch — UNVERIFIED:** инструмент не предоставляет
  timezone override, `Intl` недоступен в sandbox, диагностическая вставка в DevTools
  заблокирована self-XSS защитой. Защита не обходилась; это ограничение инструмента,
  не ошибка приложения. Нет реального или эмулированного touch-контекста.
  Автоматические jsdom TZ-тесты не подменяют эти браузерные проверки.
- **Нативный clipboard — PASS только для наблюдённого поведения Chrome Incognito:**
  Cmd+C/Cmd+V целого блока A → B увеличил число calendar-блоков с 2 до 3; вставленный
  блок использовал только синтетический контекст B. Его месяц April, остальных March.
  Внешние HTML- и text-поля получили `[Calendar unavailable]`. После контрольного
  содержимого clipboard выделение `SYNTHETIC A · US DST` также дало placeholder в
  обоих полях. Raw MIME и JSON бизнес-пропсов вставленного блока не читались;
  синтетический B не доказывает настоящий серверный проект/ACL. Без контекста
  readonly placeholder визуально inert, но нативная вставка туда UNVERIFIED.
- **Открытые границы:** Network-наблюдение отсутствия календарных запросов,
  настоящая viewer-сессия (публичный membership API не поддерживает нужный сценарий),
  production delivery и перечисленные выше неподтверждённые действия. Автоматические
  readonly/server-role моки не являются приёмкой реального viewer.

## Матрица проверки (2026-10-31)

PASS ограничен указанным уровнем. «Внешний Codex» означает переданное пользователем
свидетельство из раздела выше, не повторный запуск локальным агентом.

| Требование                                                   | Проверка и свидетельство                                                                                               | Статус                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Точные версии, Standard без Premium, лицензии                | package.json/lockfile + registry, таблица выше                                                                         | PASS                        |
| Изолированный вход, нет production UX                        | серверный guard; dev HTTP 200, production HTTP 404; production creators не менялись                                    | PASS                        |
| Next compile/typecheck/lint                                  | `pnpm --filter @noto/web build`, `typecheck`, `lint` — exit 0                                                          | PASS                        |
| Runtime в проверенных браузерных сценариях                   | внешний Codex: REST-повтор и UX без ошибок; старое auth warning отдельно UNKNOWN; полного console trace нет            | PASS (наблюдённые действия) |
| ru/Monday, соседние JSX-карточки, точный диапазон до 42 дней | jsdom реального FullCalendar: март 42 дня, апрель 35; itemClick                                                        | PASS                        |
| date-only, две зоны и DST                                    | обе integration suites в `TZ=America/Los_Angeles` и `TZ=Europe/Berlin`: по 11/11                                       | PASS                        |
| Browser timezone/DST                                         | нет timezone override, Intl недоступен, DevTools self-XSS блокирует диагностическую вставку; jsdom не заменяет браузер | UNVERIFIED                  |
| Mouse date/card click                                        | внешний Codex: диагностические действия выполнены                                                                      | PASS (внешний Codex)        |
| Touch                                                        | нет реального/эмулированного touch-контекста                                                                           | UNVERIFIED                  |
| Drag handle / отсутствие случайного mouse drag               | внешний Codex: handle переместил блок; Next/Previous, card click и drag внутри calendar не меняли порядок/счётчик      | PASS (внешний Codex)        |
| Внешний контролируемый месяц                                 | jsdom rerender меняет реальную сетку и range                                                                           | PASS                        |
| URL back/forward без цикла                                   | внешний Codex: переходы назад/вперёд                                                                                   | PASS (внешний Codex)        |
| Light/dark, full/narrow, focus/overflow                      | внешний Codex: 1280px screenshot, narrow 320px / scrollWidth 318, truncation, Tab/Shift+Tab                            | PASS (проверенные размеры)  |
| Одна схема JSON editable/readonly и Yjs                      | реальные BlockNote JSON serialize/remount + binary encode/applyUpdate + decode                                         | PASS                        |
| REST persisted/reload, editorMode rest                       | внешний Codex после fix: match true, текстовый маркер и два calendar-блока после GET/reload                            | PASS (внешний Codex)        |
| Collab peers/reconnect, editorMode collab                    | внешний Codex: promotion пустой fixture, PEER133, новый Y.Doc                                                          | PASS (внешний Codex)        |
| Collab persistence через graceful restart                    | внешний Codex: отдельно согласованный SIGTERM, сохранённый документ загрузился новым клиентом                          | PASS (graceful only)        |
| Порядок PATCH → GET в реальном Network                       | events/HAR не доступны; UI и wiring-тест не заменяют Network trace                                                     | UNVERIFIED                  |
| Opt-in transport safety / lifecycle                          | HTTP/provider mocks: marker/confirmation, populated REST отказ, viewer, sync gating, fresh GET, new Y.Doc, cleanup     | PASS (wiring only)          |
| Два месяца независимо, без изменений документа/Yjs           | integration JSON/binary неизменны; внешний Codex: REST content/updatedAt и Yjs counters неизменны при смене месяца     | PASS                        |
| Undo текста / возврат фокуса в браузере                      | внешний Codex: undo текста, месяц не откатывается, фокус возвращается в текст                                          | PASS (внешний Codex)        |
| Narrow focus / readonly ввод и paste / локальная навигация   | внешний Codex: Next/Previous → paragraph + ввод; readonly 3 блока / changes 0, editable paste работает, April/March    | PASS (только стенд)         |
| Пустые props и безопасный export                             | реальные exporters, internal HTML parser; статический placeholder; native-island copy handler в jsdom                  | PASS                        |
| Native clipboard: блок A → B и внешний placeholder           | внешний Codex, Chrome Incognito: 2 → 3 блока, контекст B, HTML/text placeholder; raw MIME/JSON не читались             | PASS (наблюдённое UI)       |
| Clipboard: реальный целевой проект/ACL, JSON бизнес-пропсов  | только синтетические A/B; серверный проект и JSON после native paste не проверены                                      | UNVERIFIED                  |
| Readonly binding / отсутствие контекста                      | автоматический readonly binding; внешний Codex: inert placeholder визуально; native paste туда не проверен             | PASS (только стенд)         |
| Реальная viewer-сессия / Network без calendar fetch          | viewer API-сценарий недоступен; Network не наблюдался                                                                  | UNVERIFIED                  |
| Регрессии существующего frontend/editor                      | после REST-fix: полный `pnpm --filter @noto/web test`, 42 файла, 262 теста; targeted wiring 11/11                      | PASS                        |
| Независимый CODE review узкого REST-fix                      | внешний Claude: APPROVE, без HIGH; два LOW follow-up, без запусков                                                     | PASS (узкий scope)          |
| Агрегатный bundle delta / решение lazy grid                  | исторический du baseline и замеры ниже; lazy grid выбран, production creators не менялись                              | PASS (ограниченный замер)   |
| Реальный delivery/route bundle delta                         | static manifest audit не является Network trace; route baseline отсутствует                                            | UNVERIFIED                  |

Интеграционный файл: `calendar-integration.test.tsx`, 5 тестов без моков
FullCalendar/BlockNote. `calendar-real-roundtrip.test.tsx` — 11 wiring-тестов
с mock HTTP/provider/BlockNote, не серверная проверка. Предупреждение ProseMirror
`TextSelection endpoint not pointing into a node with inline content (blockContainer)`
было связано с начальной text selection на non-inline calendar: локальные fixtures
теперь начинаются с paragraph, вставка идёт после первого блока. В integration
stderr предупреждение больше не воспроизводится, не подавлялось. Это не исправление
произвольных production-документов и не доказательство browser focus/undo.
Vite также предупреждает о существующем CommonJS config; `pnpm peers check`
показывает несовместимые диапазоны ESLint 10 у существующих eslint plugins,
не у новых зависимостей. Конфигурация и версии ради этого не менялись.

## Размер сборки

Исторические измерения на одной машине, тот же Next build и команда
`du -sk apps/web/.next/static/chunks` после успешного production build
(в текущем docs-only проходе не повторялись):

- до установки/изменений, HEAD `8639465`: **4040 KiB**;
- предыдущий локальный стенд: **5300 KiB**;
- стенд с real-transport harness: **5860 KiB**;
- разница с исходным baseline: **+1820 KiB** выделенного дискового пространства каталога.

Это агрегат всех static chunks (включая потенциально неиспользуемые маршрутом),
не точные байты JS, не gzip/brotli, не initial-load и не стоимость одного
FullCalendar. Client-only entry/BlockNote/стенд и разбиение chunks также влияют
на результат. Отдельный baseline route bundle не сохранялся, delivery delta
остаётся UNVERIFIED. Dev-only guard защищает UX, но не обещает нулевого размера
экспериментального кода в production артефакте.

Дополнительный read-only static-анализ после build, последний результат передан
оркестратором 2026-10-31 (в текущем docs-only проходе не запускался):
`pnpm --filter @noto/web exec node src/widgets/editor/spike/profile-calendar-bundle.ts`.
Node 24 исполняет TS без новых зависимостей. Метод: суммировать точные JS/CSS bytes,
gzip level 9 отдельно для каждого файла; не network profiling и не baseline delta.
Все 42 JS/CSS chunks: **5 935 474 bytes**, gzip **1 547 103 bytes**.
Набор client references обычного `/app/[pageId]/page` из его Next manifest:
11 файлов, **1 858 066 bytes**, gzip **506 543 bytes**; ссылок на module paths
`calendar-spike/calendar-schema/month-grid/@fullcalendar` в нём **0**.
Это ограниченное свидетельство начального reference set, не полный lazy dependency
closure и не гарантия фактической загрузки браузера. Чистый route delivery delta
остаётся UNVERIFIED; исторического byte/gzip baseline нет.
Предупреждение Node о typeless module относится к запуску audit-скрипта;
конфигурация ради него не менялась. Byte/gzip числа не вычитаются из исторического
`du` в KiB: это разные измерения. Измеренный агрегатный рост и lazy-направление
отвечают bundle-вопросу спайка в указанной границе, но не доказывают стоимость
одного календаря или фактический production delivery. Network HAR не добавляется
как новое обязательное требование #133; отсутствие такого свидетельства просто
не позволяет объявить соответствующие сетевые утверждения PASS.

## Граница завершения

Готовы воспроизводимый стенд и автоматические integration/regression checks.
Узкий REST-fix одобрен Claude; 2026-10-31 человек принял результат исследовательского
spike #133 и выбор FullCalendar Standard `@fullcalendar/react@7.1.3` с
`temporal-polyfill@1.0.1` с перечисленными ограничениями. Приёмка результата
не переводит неподтверждённые проверки в PASS. Browser LA/Berlin и touch остаются
UNVERIFIED; реальная viewer-сессия недоступна через текущий публичный membership
API. JSON бизнес-пропсов после native paste не исследован (автоматические локальные
roundtrip-тесты пустых props PASS), native paste без контекста не выполнялся.
Raw MIME не прочитан, хотя наблюдённый native HTML/text placeholder PASS.
Network trace и production delivery/route delta отсутствуют; агрегатный
`du` delta **+1820 KiB** и lazy-решение подтверждены только указанным методом.
Старое Hocuspocus auth warning остаётся UNKNOWN, а collab durability подтверждена
через graceful restart, без обещания crash recovery.

Эти границы важны для оценки рисков спайка и будущей production-приёмки, но не
создают новых обязательных требований динамического HAR или реализации #135–#139
для закрытия #133. Человеческая приёмка с ограничениями зафиксирована выше;
она не означает готовность production #135–#139 или закрытие GitHub issue.
Production creators не менялись, #135 не начата. Экспериментальная схема не
включается в production документ автоматически на основании приёмки спайка
или APPROVE узкого REST-fix. LOW follow-up ревью не исправлялись.
По переданному подтверждению граф обновлён оркестратором после последнего CODE review;
в этом docs-only проходе граф не обновлялся. Коммиты, push и изменения issue/PR не делались.
