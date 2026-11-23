import { css } from "styled-components";
import { type StyledTheme } from "@theme";

/**
 * Shared minimalist scrollbar styling (WebKit + Firefox) using the
 * theme's primary palette. Reuse in any scrollable styled component.
 */
export const minimalistScrollbar = css`
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.primary.main};
    border-radius: 3px;
    opacity: 0.5;
    transition: opacity 200ms ease, background-color 200ms ease;
  }
  &::-webkit-scrollbar-thumb:hover {
    opacity: 0.8;
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.primary.light};
  }
  &::-webkit-scrollbar-thumb:active {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.primary.dark};
    opacity: 1;
  }
  &::-webkit-scrollbar-corner {
    background: transparent;
  }

  scrollbar-width: thin;
  scrollbar-color:
    ${({ theme }) => (theme as StyledTheme).palette.primary.main}
    transparent;
`;
