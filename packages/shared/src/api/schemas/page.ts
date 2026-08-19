import { z } from 'zod';

/** Ограничения заголовка страницы (валидация create/update). */
export const PAGE_TITLE_MIN_LENGTH = 1;
export const PAGE_TITLE_MAX_LENGTH = 200;

/**
 * Потолок размера контента — предохранитель от аномальных пейлоадов. Меряем по
 * длине сериализованного JSON (кросс-энв, без TextEncoder/Buffer); для гардрейла
 * байт-точность не нужна.
 */
export const PAGE_CONTENT_MAX_LENGTH = 1_000_000; // ~1 MB

const pageTitleSchema = z
  .string()
  .trim()
  .min(PAGE_TITLE_MIN_LENGTH)
  .max(PAGE_TITLE_MAX_LENGTH);

/**
 * Контент страницы — непрозрачный BlockNote-док: массив блоков. Бэк валидирует
 * только верхний уровень (массив) и размер (≤ 1 MB), не структуру блоков —
 * это владение BlockNote на фронте.
 */
export const pageContentSchema = z
  .array(z.unknown())
  .refine((content) => JSON.stringify(content).length <= PAGE_CONTENT_MAX_LENGTH, {
    message: `content exceeds ${PAGE_CONTENT_MAX_LENGTH} characters`,
  });

/** Публичное представление страницы (без deletedAt и внутренних полей). */
export const pageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  content: z.array(z.unknown()),
  position: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Page = z.infer<typeof pageSchema>;

/** Тело create. `projectId` — из пути, не из тела. Контент по умолчанию пустой. */
export const createPageSchema = z.object({
  title: pageTitleSchema,
  parentId: z.uuid().nullish(),
  content: pageContentSchema.optional(),
  position: z.number().int().optional(),
});

/** Тело update (PATCH, частичный). Любое подмножество полей; смена
 * `parentId`/`position` = перемещение в дереве. */
export const updatePageSchema = z
  .object({
    title: pageTitleSchema.optional(),
    parentId: z.uuid().nullable().optional(),
    content: pageContentSchema.optional(),
    position: z.number().int().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'at least one field is required',
  });

/** Ответ с одной страницей. */
export const pageResponseSchema = z.object({
  page: pageSchema,
});

/** Ответ со списком страниц (плоский, дерево строит фронт по parentId). */
export const pagesResponseSchema = z.object({
  pages: z.array(pageSchema),
});
