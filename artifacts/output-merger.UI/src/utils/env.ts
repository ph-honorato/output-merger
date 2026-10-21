/**
 * Reads a numeric environment variable (the Vite `VITE_*` namespace,
 * exposed to the client): trims, parses, and validates — the value
 * must be a finite integer greater than zero. Anything else (a
 * missing variable, an empty or malformed value, zero, a negative
 * number, a non-integer) falls back to the given default.
 */
export const readEnvNumber = (key: string, fallback: number): number => {
  const raw = import.meta.env[key];
  if (typeof raw !== 'string') {
    return fallback;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};
