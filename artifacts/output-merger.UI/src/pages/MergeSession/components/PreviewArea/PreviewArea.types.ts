import type { EntranceAnimationProps } from "@shared-types/animation";

/**
 * Props for the PreviewArea component
 * @interface PreviewAreaProps
 */
export interface PreviewAreaProps extends EntranceAnimationProps {
  /**
   * Optional class name applied to the root element
   */
  className?: string;
  /**
   * Optional notification of this instance's drag lifecycle: fires
   * `true` when a drag activates in this instance (pointer hold or
   * keyboard pickup) and `false` when the drag ends or cancels —
   * on every path. Purely additive: consumers that do not pass it
   * keep the exact existing behavior (the callback defaults to a
   * no-op). The preview modal uses it to keep Escape cancelling only
   * the drag while the dialog stays open.
   */
  onActiveDragChange?: (active: boolean) => void;
  /**
   * Whether this instance renders the document char counter row
   * inside its card (below the scrolling flow area). Purely
   * additive: defaults to true (the default view's textarea look).
   * The preview modal passes false — it renders the counter as the
   * last element of its tools rail instead.
   */
  showCharCount?: boolean;
}
