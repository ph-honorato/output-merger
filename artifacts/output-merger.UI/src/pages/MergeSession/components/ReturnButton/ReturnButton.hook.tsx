import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReturnButtonProps } from './ReturnButton.types';

export const RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY =
  'output-merger.return-confirmation-dismissed';

/**
 * Reads the stored "don't show again" preference. A throwing
 * localStorage (privacy mode, embedded context) reads as not
 * dismissed — the confirmation dialog always shows.
 */
export const readReturnConfirmationDismissed = (): boolean => {
  try {
    return (
      window.localStorage.getItem(RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY) ===
      'true'
    );
  } catch {
    return false;
  }
};

/**
 * Stores the "don't show again" preference. A throwing localStorage
 * swallows the write — the preference stays session-only.
 */
export const writeReturnConfirmationDismissed = (): void => {
  try {
    window.localStorage.setItem(
      RETURN_CONFIRMATION_DISMISSED_STORAGE_KEY,
      'true',
    );
  } catch {
    // Storage unavailable (privacy mode, embedded context): the
    // preference stays session-only.
  }
};

/**
 * Owns the Return button's UX state: the confirmation dialog's open
 * flag, the disabled-while-open gate, and the "don't show again"
 * preference. The preference is read at click time, so a stored
 * value makes the click proceed immediately with no dialog, and a
 * mid-session storage change takes effect on the next click. The
 * button itself stays UX-only — the confirm callback carries the
 * reset orchestration owned by the caller.
 */
export function useReturnButton({ onConfirm }: ReturnButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleReturnClick = useCallback(() => {
    if (readReturnConfirmationDismissed()) {
      onConfirm();
      return;
    }
    setOpen(true);
  }, [onConfirm]);

  const handleConfirm = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain) {
        writeReturnConfirmationDismissed();
      }
      setOpen(false);
      onConfirm();
    },
    [onConfirm],
  );

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    t,
    open,
    disabled: open,
    handleReturnClick,
    handleConfirm,
    handleCancel,
  };
}
