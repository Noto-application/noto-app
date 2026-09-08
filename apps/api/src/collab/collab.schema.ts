import { z } from 'zod';

/**
 * Тело internal collab-authorize (#108). Zod-валидатор (ADR-012): невалидное
 * тело → 400 VALIDATION_ERROR. Endpoint внутренний, не часть публичного
 * ts-rest-контракта, поэтому схема живёт локально в модуле, а не в @noto/shared.
 */
export const collabAuthorizeBodySchema = z.object({
  documentName: z.uuid(),
});

export type CollabAuthorizeBody = z.infer<typeof collabAuthorizeBodySchema>;
