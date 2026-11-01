import type { ReactNode } from 'react';

/**
 * Horizontal placement of children inside the ActionsBar
 */
export type ActionsBarAlign = 'left' | 'right';

/**
 * Props for the ActionsBar component
 * @interface ActionsBarProps
 */
export interface ActionsBarProps {
  /**
   * Horizontal placement of children inside the bar. Default 'right'
   */
  align?: ActionsBarAlign;
  /**
   * Content rendered inside the bar
   */
  children?: ReactNode;
  /**
   * Optional class name applied to the root element
   */
  className?: string;
}
