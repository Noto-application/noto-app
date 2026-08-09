import { Module } from '@nestjs/common';

/**
 * Projects CRUD — минимальный стаб под test-first (RFC-008).
 * Контроллер/сервис/guard добавляются отдельной задачей после ревью тестов
 * (спека: projects.spec.md). Пока модуль пустой: эндпоинты ещё не смонтированы,
 * e2e-тесты красные (404), пока реализация не готова.
 */
@Module({})
export class ProjectsModule {}
