// Прямой запуск Jest не должен случайно очистить БД и Redis из рабочего .env.
if (process.env.NOTO_E2E_ISOLATED !== '1') {
  throw new Error('Запускайте e2e через pnpm --filter @noto/api test:e2e (нужен Docker).');
}
