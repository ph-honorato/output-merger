import { keyframes } from 'styled-components';

/**
 * Slide up + fade in keyframes for entrance animations.
 * Starts 30px below final position, fully transparent.
 */
export const slideUpFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

/**
 * Generate a stagger delay value for CSS animation-delay.
 * @param index - Zero-based index in the stagger sequence
 * @param baseDelay - Initial delay before first element starts (ms)
 * @param staggerGap - Gap between each subsequent element (ms)
 * @returns CSS time value string (e.g., "180ms")
 */
export function getStaggerDelay(
  index: number,
  baseDelay = 100,
  staggerGap = 80
): string {
  return `${baseDelay + index * staggerGap}ms`;
}

/**
 * CSS animation property value for slideUpFadeIn with configurable delay.
 * Includes reduced-motion support via media query (handled in consuming component).
 */
export function slideUpFadeInAnimation(delay: string): string {
  return `${slideUpFadeIn} 400ms ease-out ${delay} forwards`;
}