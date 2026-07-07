/**
 * Minimal className joiner — filters out falsy values.
 * Kept dependency-free on purpose (no clsx/tailwind-merge).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
