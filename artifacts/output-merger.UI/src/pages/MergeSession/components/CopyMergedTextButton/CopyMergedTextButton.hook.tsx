import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';
import { applyAutoFix, serialize } from '../../../../utils/previewDocument';

export function useCopyMergedTextButton() {
  const { t } = useTranslation();
  // The context's document model (an ordered token array), aliased on
  // destructure to avoid confusion with the DOM global `document`.
  const { document: previewDocument, editEnabled, caseFixLanguage } = useSnippets();
  const [toastOpen, setToastOpen] = useState(false);

  // The clipboard payload is the serialization of the auto-fixed
  // document (case → spacing → case). The pass runs over a
  // transformed copy of the tokens — the context document is never
  // mutated — and re-derives when the document or the store's
  // language field changes (the provider keeps it current), so
  // display and clipboard always derive under the same rule set and
  // the payload stays fully corrected even while the visible
  // document holds stale case or spacing (the per-input sync skips
  // the pass while the focused surface owns its DOM).
  const mergedText = useMemo(
    () => serialize(applyAutoFix(previewDocument, caseFixLanguage)),
    [previewDocument, caseFixLanguage],
  );

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
