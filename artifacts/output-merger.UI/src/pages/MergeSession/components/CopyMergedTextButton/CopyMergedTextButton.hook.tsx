import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';
import { serialize } from '../../../../utils/previewDocument';

export function useCopyMergedTextButton() {
  const { t } = useTranslation();
  // The context's document model (an ordered token array), aliased on
  // destructure to avoid confusion with the DOM global `document`.
  const { document: previewDocument, editEnabled } = useSnippets();
  const [toastOpen, setToastOpen] = useState(false);

  const mergedText = useMemo(() => serialize(previewDocument), [previewDocument]);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard
      .writeText(mergedText)
      .then(() => {
        setToastOpen(true);
      })
      .catch(() => {});
  }, [mergedText]);

  const handleToastClose = useCallback(() => {
    setToastOpen(false);
  }, []);

  return {
    t,
    // Gating matrix: edit ON → copy is always enabled (an empty
    // document copies the empty string); edit OFF → enabled iff the
    // document serializes to something (today's behavior).
    canCopy: editEnabled || mergedText.length > 0,
    handleCopy,
    toastOpen,
    handleToastClose,
  };
}
