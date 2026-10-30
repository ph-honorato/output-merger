import type { ReactNode } from 'react';

/**
 * Props for the PreviewToolbar component
 * @interface PreviewToolbarProps
 */
export interface PreviewToolbarProps {
  /**
   * Content rendered inside the toolbar (one icon button per tool)
   */
  children?: ReactNode;
  /**
   * Optional class name applied to the root element
   */
  className?: string;
  /**
   * Optional entrance delay for staggered animation (e.g., "550ms")
   */
  $entranceDelay?: string;
}
