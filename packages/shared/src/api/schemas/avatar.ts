import { z } from 'zod';

export const AVATAR_MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
export const AVATAR_MAX_NORMALIZED_SIZE = 256 * 1024;
export const AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const avatarContentTypeSchema = z.enum(AVATAR_CONTENT_TYPES);

/** Метаданные аватара с временным URL чтения. */
export const avatarSchema = z.object({
  url: z.url(),
  contentType: avatarContentTypeSchema,
  size: z.number().int().min(1).max(AVATAR_MAX_NORMALIZED_SIZE),
});
export type Avatar = z.infer<typeof avatarSchema>;

/** Данные для выдачи presigned URL загрузки аватара. */
export const createAvatarUploadSchema = z.object({
  contentType: avatarContentTypeSchema,
  size: z.number().int().min(1).max(AVATAR_MAX_UPLOAD_SIZE),
});

export const avatarUploadSchema = z.object({
  uploadId: z.string().min(1),
  url: z.url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()).refine((headers) => Object.keys(headers).length > 0),
  expiresAt: z.iso.datetime(),
});
export type AvatarUpload = z.infer<typeof avatarUploadSchema>;

export const avatarUploadResponseSchema = z.object({
  upload: avatarUploadSchema,
});
