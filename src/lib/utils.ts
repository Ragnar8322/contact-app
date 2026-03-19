import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes an input string to be securely used in PostgreSQL `LIKE` or `ILIKE` queries.
 * 
 * In PostgreSQL, `%` matches any sequence of characters, and `_` matches any single character.
 * If user input contains these raw characters, they can lead to unintended wildcard searches,
 * potentially bypassing security logic or causing severe performance degradation (full table scans).
 * The `\` character is the default escape character in Postgres, so it must be escaped first.
 * 
 * @param query The raw user input string.
 * @returns The sanitized string safe for Supabase `ilike` filters.
 */
export function sanitizePgSearch(query: string): string {
  if (!query) return '';
  return query.replace(/[\\%_]/g, '\\$&');
}
