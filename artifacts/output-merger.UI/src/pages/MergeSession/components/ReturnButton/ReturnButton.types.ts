/**
 * Props for the ReturnButton component
 * @interface ReturnButtonProps
 */
export interface ReturnButtonProps {
  /**
   * Called once the return is confirmed — or skipped through the
   * stored "don't show again" preference; the caller owns the reset
   * orchestration behind the click
   */
  onConfirm: () => void;
}
