/**
 * Shared animation-related types.
 */

/**
 * Entrance animation delay (e.g., '100ms').
 * Used for staggered page-load animations.
 */
export type EntranceDelay = string;

/**
 * Props for components that support entrance animations.
 */
export interface EntranceAnimationProps {
  /**
   * Entrance animation delay (e.g., '100ms').
   * Used for staggered page-load animations.
   */
  $entranceDelay?: EntranceDelay;
}