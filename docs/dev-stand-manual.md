# Первая ручная выкладка dev-стенда

Этот документ описывает единственную контролируемую ручную установку. Автодеплой,
SFTP-выгрузка backup и любые server-side deploy scripts в этот этап не входят.

## Состав

Compose project `noto-dev` запускает Caddy, web, API, collab, PostgreSQL и Redis.
Снаружи публикуются только TCP 80/443 Caddy. API, collab, PostgreSQL и Redis не
имеют host ports. Caddy направляет `/api/*` в API, `/collab*` в collab и возвращает
404 для `/internal/*`.

## До запуска

1. Собрать и опубликовать вне сервера четыре Linux/amd64 image из одного merged
   commit, используя полный SHA как tag: `noto-api`, `noto-api-migrate`,
   `noto-collab`, `noto-web`. Для web build задать публичный HTTPS API URL и
   `NEXT_PUBLIC_COLLAB_ENABLED=true`.
2. На сервере создать `/srv/noto-dev/runtime`; скопировать `deploy/compose.yml`,
   `deploy/Caddyfile`, `deploy/noto-dev.env.example` как `.env` и оба runtime env
   template как реальные env files. Не копировать local/smoke Compose файлы.
3. Сгенерировать на сервере отдельные PostgreSQL, JWT и collab secrets. Значения
   runtime env files не коммитить и не печатать.
4. Разрешить только TCP 80 и 443 в действующем UFW. Не менять SSH, VPN, Mieru или
   чужие Docker containers/networks/volumes.

## Ручной запуск

Все команды выполнять из `/srv/noto-dev` через `sudo docker compose`:

```bash
sudo docker compose --project-name noto-dev --env-file .env -f compose.yml up -d postgres redis
sudo docker compose --project-name noto-dev --env-file .env -f compose.yml run --rm api-migrate
sudo docker compose --project-name noto-dev --env-file .env -f compose.yml up -d api collab web caddy
sudo docker compose --project-name noto-dev --env-file .env -f compose.yml ps
```

Если migration завершается ошибкой, не запускать application containers и не
считать image rollback откатом схемы БД. Сначала зафиксировать логи и принять
отдельное решение о восстановлении.

## Приёмка

1. Открыть HTTPS origin, зарегистрироваться, войти и создать страницу.
2. Проверить, что `/internal/anything` отвечает 404, а 4000/5432/5555/6379 не
   опубликованы на host.
3. Открыть одну collab-страницу в двух независимых browser sessions, внести
   timestamped строку и увидеть её во второй сессии.
4. Выполнить controlled `restart collab`, открыть страницу в третьей сессии и
   убедиться, что строка сохранилась.

Автоматическое обновление, SFTP backup pull и регулярные backup jobs будут
подготовлены отдельной задачей после успешной ручной выкладки.
