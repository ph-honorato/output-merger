import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReturnConfirmationModalProps } from './ReturnConfirmationModal.types';

/**
 * The dialog's presentational state: the "don't show again"
 * checkbox flag and the button handlers. Every close path — Confirm,
 * Cancel, the backdrop click, and the Escape key — resets the flag,
 * so the next open always starts unchecked. The modal only reports:
 * persistence and the return itself stay with the parent through
 * the three callbacks.
 */
export function useReturnConfirmationModal({
  onConfirm,
  onCancel,
}: ReturnConfirmationModalProps) {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleCheckboxChange = useCallback(
    (_event: unknown, checked: boolean) => {
      setDontShowAgain(checked);
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    const flag = dontShowAgain;
    setDontShowAgain(false);
    onConfirm(flag);
  }, [onConfirm, dontShowAgain]);

  // Also the Dialog onClose funnel: the backdrop click and the
  // Escape key close through here, behaving exactly like Cancel —
  // the dialog closes without confirming anything.
  const handleCancel = useCallback(() => {
    setDontShowAgain(false);
    onCancel();
  }, [onCancel]);

  return {
    t,
    dontShowAgain,
    handleCheckboxChange,
    handleConfirm,
    handleCancel,
  };
}
