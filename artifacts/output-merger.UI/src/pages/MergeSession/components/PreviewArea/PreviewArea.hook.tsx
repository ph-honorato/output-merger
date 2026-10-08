import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';

/**
 * Converts a hex color (#rgb or #rrggbb) to an rgba() string with the
 * given alpha. Returns the input unchanged when it is not a hex color.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#(?:([0-9a-fA-F]{3})|([0-9a-fA-F]{6}))$/.exec(hex.trim());
  if (!match) {
    return hex;
  }
  const digits = match[1]
    ? match[1]
        .split('')
        .map((c) => c + c)
        .join('')
    : match[2];
  const r = parseInt(digits.slice(0, 2), 16);
  const g = parseInt(digits.slice(2, 4), 16);
  const b = parseInt(digits.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Composes i18n translation with the global merge-ordered snippets list
 */
export function usePreviewArea() {
  const { t } = useTranslation();
  const { snippets } = useSnippets();
  return { t, snippets };
}
