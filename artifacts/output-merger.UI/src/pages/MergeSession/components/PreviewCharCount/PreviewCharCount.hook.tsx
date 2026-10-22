import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnippets } from '../../../../context/SnippetsContext';
import {
  PREVIEW_DOCUMENT_MAX_LENGTH,
  serialize,
} from '../../../../utils/previewDocument';

/**
 * The counter's live values: the serialized document's current
 * character count (the same measure the document limit guards), the
 * limit it counts against, and whether the document has reached it
 * (the counter turns red).
 */
export const usePreviewCharCount = () => {
  const { t } = useTranslation();
  const { document } = useSnippets();
  const count = useMemo(() => serialize(document).length, [document]);
  const max = PREVIEW_DOCUMENT_MAX_LENGTH;
  const atLimit = count >= max;
  const label = t('pages.mergeSession.previewArea.counterLabel');
  return { count, max, atLimit, label };
};
