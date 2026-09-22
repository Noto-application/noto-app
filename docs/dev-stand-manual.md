# Первая ручная выкладка dev-стенда

Этот документ описывает единственную контролируемую ручную установку. Автодеплой,
SFTP-выгрузка backup и любые server-side deploy scripts в этот этап не входят.

## Состав

Compose project `noto-dev` запускает Caddy, web, API, collab, PostgreSQL и Redis.
Снаружи публикуются только TCP 80/443 Caddy. API, collab, PostgreSQL и Redis не
имеют host ports. Caddy направляет `/api/*` в API, `/collab*` в collab и возвращает
404 для `/internal/*`.

## До запуска

1. Выбрать уже merged release commit и задать его полный 40-символьный SHA.
   Собрать и опубликовать все четыре Linux/amd64 image вне сервера из этого
   единственного commit. Не использовать сокращённый SHA и не подставлять
   секреты в команды или логи:

   ```bash
   export GHCR_IMAGE_PREFIX=ghcr.io/<organization>
   export IMAGE_TAG=<full-40-character-merged-commit-sha>
   export NOTO_PUBLIC_HOST=<host>

   test "${#IMAGE_TAG}" -eq 40
   git rev-parse --verify "${IMAGE_TAG}^{commit}"
   git switch --detach "$IMAGE_TAG"
   test "$(git rev-parse HEAD)" = "$IMAGE_TAG"

   printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin

   docker buildx build --platform linux/amd64 --target runtime \
     --tag "${GHCR_IMAGE_PREFIX}/noto-api:${IMAGE_TAG}" --push \
     --file apps/api/Dockerfile .
   docker buildx build --platform linux/amd64 --target migration \
     --tag "${GHCR_IMAGE_PREFIX}/noto-api-migrate:${IMAGE_TAG}" --push \
     --file apps/api/Dockerfile .
   docker buildx build --platform linux/amd64 \
     --tag "${GHCR_IMAGE_PREFIX}/noto-collab:${IMAGE_TAG}" --push \
     --file apps/collab/Dockerfile .
   docker buildx build --platform linux/amd64 \
     --build-arg "NEXT_PUBLIC_API_URL=https://${NOTO_PUBLIC_HOST}" \
     --build-arg NEXT_PUBLIC_COLLAB_ENABLED=true \
     --tag "${GHCR_IMAGE_PREFIX}/noto-web:${IMAGE_TAG}" --push \
     --file apps/web/Dockerfile .
   ```

   `NEXT_PUBLIC_API_URL` — это origin API без суффикса `/api`. Если GHCR package
   приватный, перед первым `pull` на сервере выполнить интерактивно
   `sudo docker login ghcr.io`; пароль или token не печатать и не передавать
   через аргумент командной строки.
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
   заранее известную точную строку и увидеть ту же строку во второй сессии.
4. Закрыть обе исходные сессии, затем выполнить controlled `restart collab`.
   Только после полного перезапуска открыть новую сессию и сверить точную
   строку. Закрытые клиенты не должны переподключаться и повторно засевать
   сервер старым состоянием.

Автоматическое обновление, SFTP backup pull и регулярные backup jobs будут
подготовлены отдельной задачей после успешной ручной выкладки.
