// Enum-like values. SQLite has no native Prisma enums, so these string unions
// are the single source of truth used across the app and validated with Zod.

export const UserRole = {
  ADMIN: "ADMIN",
  GUEST: "GUEST",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Dutch display labels for roles.
export const roleLabel: Record<string, string> = {
  ADMIN: "Beheerder",
  GUEST: "Gast",
};

export const EditionStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type EditionStatus = (typeof EditionStatus)[keyof typeof EditionStatus];

// Dutch display labels for edition statuses.
export const editionStatusLabel: Record<string, string> = {
  DRAFT: "Concept",
  PUBLISHED: "Gepubliceerd",
  ARCHIVED: "Gearchiveerd",
};

export const PhotoStatus = {
  UPLOADING: "UPLOADING",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type PhotoStatus = (typeof PhotoStatus)[keyof typeof PhotoStatus];
