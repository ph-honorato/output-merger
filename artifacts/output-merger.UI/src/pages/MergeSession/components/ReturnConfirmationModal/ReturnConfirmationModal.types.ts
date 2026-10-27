/**
 * Props for the ReturnConfirmationModal component
 * @interface ReturnConfirmationModalProps
 */
export interface ReturnConfirmationModalProps {
  /**
   * Whether the dialog is open — fully controlled by the parent
   */
  open: boolean;
  /**
   * Confirms the return; carries the checkbox flag so the parent
   * owns whether the preference persists
   */
  onConfirm: (dontShowAgain: boolean) => void;
  /**
   * Cancels the return — also the path the backdrop click and the
   * Escape key funnel into
   */
  onCancel: () => void;
}
