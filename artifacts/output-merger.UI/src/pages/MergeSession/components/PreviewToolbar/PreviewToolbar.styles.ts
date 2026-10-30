import styled, { css } from "styled-components";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";
import { slideUpFadeIn } from "@utils/animations";

type StyledTheme = DefaultTheme & Theme;

export const PreviewToolbarRoot = styled.div<{ $entranceDelay?: string }>`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(0.5)};
  padding: ${({ theme }) => (theme as StyledTheme).spacing(0.5)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: ${({ theme }) => (theme as StyledTheme).borderRadius};
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);

  ${({ theme }) => (theme as StyledTheme).breakpoints.up("md")} {
    flex-direction: column;
  }

  /* Final state (after animation): fully visible, no transform.
   * Explicit transform: none prevents containing block for fixed-position
   * descendants which would misposition any fixed-position elements. */
  opacity: 1;
  transform: none;

  /* Entrance animation: slide up + fade in (opt-in via $entranceDelay prop).
   * Uses 'backwards' fill-mode so the first keyframe applies immediately,
   * then animates to the base styles above. No 'forwards' fill-mode means
   * no transform is retained after the animation completes. */
  ${({ $entranceDelay }) =>
    $entranceDelay !== undefined
      ? css`
          animation: ${slideUpFadeIn} 800ms ease-out ${$entranceDelay} backwards;

          @media (prefers-reduced-motion: reduce) {
            animation: none;
          }
        `
      : undefined}
`;
