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

  /* Entrance animation: slide up + fade in (opt-in via $entranceDelay prop) */
  ${({ $entranceDelay }) =>
    $entranceDelay !== undefined
      ? css`
          opacity: 0;
          animation: ${slideUpFadeIn} 800ms ease-out ${$entranceDelay} forwards;

          @media (prefers-reduced-motion: reduce) {
            animation: none;
            opacity: 1;
          }
        `
      : css`
          opacity: 1;
        `}
`;
