import { afterEach, describe, expect, it, vi } from 'vitest';
import { readEnvNumber } from './env';

/**
 * The environment reader: only a finite integer > 0 counts —
 * everything else falls back. `vi.stubEnv` writes straight into
 * `import.meta.env`, the reader's source.
 */
describe('readEnvNumber', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads a valid positive integer', () => {
    vi.stubEnv('VITE_TEST_LIMIT', '2000');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(2000);
  });

  it('trims surrounding whitespace', () => {
    vi.stubEnv('VITE_TEST_LIMIT', '  42  ');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(42);
  });

  it('falls back when the variable is missing', () => {
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
  });

  it('falls back on an empty or blank value', () => {
    vi.stubEnv('VITE_TEST_LIMIT', '');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
    vi.stubEnv('VITE_TEST_LIMIT', '   ');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
  });

  it('falls back on a non-numeric value', () => {
    vi.stubEnv('VITE_TEST_LIMIT', 'abc');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
  });

  it('falls back on zero, negatives, and non-integers', () => {
    vi.stubEnv('VITE_TEST_LIMIT', '0');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
    vi.stubEnv('VITE_TEST_LIMIT', '-10');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
    vi.stubEnv('VITE_TEST_LIMIT', '12.5');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
    vi.stubEnv('VITE_TEST_LIMIT', 'Infinity');
    expect(readEnvNumber('VITE_TEST_LIMIT', 500)).toBe(500);
  });

  it('the shipped limits fall back to their defaults (2000 / 500)', async () => {
    // The constants are evaluated at module load; this pins the
    // fallback behavior of the real keys under the test environment
    // (no .env values leak into vitest beyond the defaults).
    const previewDocument = await import('./previewDocument');
    expect(previewDocument.PREVIEW_DOCUMENT_MAX_LENGTH).toBe(2000);
    const textInput = await import('../components/TextInput/TextInput.hook');
    expect(textInput.TEXT_INPUT_MAX_CHARACTERS).toBe(500);
  });
});
