import { z } from 'zod';

/** Ограничения имени проекта (валидация create/update). */
export const PROJECT_NAME_MIN_LENGTH = 1;
export const PROJECT_NAME_MAX_LENGTH = 100;

const projectNameSchema = z
  .string()
  .trim()
  .min(PROJECT_NAME_MIN_LENGTH)
  .max(PROJECT_NAME_MAX_LENGTH);

/** Публичное представление проекта (без deletedAt и внутренних полей). */
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Project = z.infer<typeof projectSchema>;

/** Тело create. */
export const createProjectSchema = z.object({
  name: projectNameSchema,
});

/** Тело update (пока только переименование). */
export const updateProjectSchema = z.object({
  name: projectNameSchema,
});

/** Ответ с одним проектом. */
export const projectResponseSchema = z.object({
  project: projectSchema,
});

/** Ответ со списком проектов. */
export const projectsResponseSchema = z.object({
  projects: z.array(projectSchema),
});
