import { keyframes } from "styled-components";

/**
 * Slide up + fade in keyframes for entrance animations.
 * Starts 100px below final position, fully transparent.
 */
export const slideUpFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(100px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;