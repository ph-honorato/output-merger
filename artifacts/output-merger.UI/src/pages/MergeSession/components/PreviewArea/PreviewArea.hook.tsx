import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';

/**
 * Composes i18n translation with the global merge-ordered snippets list
 */
export function usePreviewArea() {
  const { t } = useTranslation();
  const { snippets } = useSnippets();
  return { t, snippets };
}
