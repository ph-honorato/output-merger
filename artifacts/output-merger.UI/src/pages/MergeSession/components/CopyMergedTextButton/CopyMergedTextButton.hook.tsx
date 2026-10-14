import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';
import type { OrderedSnippet } from '../../../../context/SnippetsContext';

export function buildMergedText(snippets: OrderedSnippet[]): string {
  return snippets.map((snippet) => snippet.text).join(' ');
}

export function useCopyMergedTextButton() {
  const { t } = useTranslation();
  const { snippets } = useSnippets();
  const [toastOpen, setToastOpen] = useState(false);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard
      .writeText(buildMergedText(snippets))
      .then(() => {
        setToastOpen(true);
      })
      .catch(() => {});
  }, [snippets]);

  const handleToastClose = useCallback(() => {
    setToastOpen(false);
  }, []);

  return {
    t,
    canCopy: snippets.length > 0,
    handleCopy,
    toastOpen,
    handleToastClose,
  };
}
