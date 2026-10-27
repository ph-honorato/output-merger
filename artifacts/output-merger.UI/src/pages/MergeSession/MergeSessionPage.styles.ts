import styled, { keyframes } from "styled-components";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";

type StyledTheme = DefaultTheme & Theme;

const gradientMesh = keyframes`
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
`;

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(3)};
  width: 100%;
  text-align: center;
`;

export const TitleRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
`;

export const Title = styled.h1`
  grid-column: 2;
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  background: linear-gradient(135deg, #0080ff, #ff1493, #00ffff);
  background-size: 200% 200%;
  background-position: 0% 50%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;

  /* One-time gradient mesh on entrance */
  animation: ${gradientMesh} 2.2s ease-in-out forwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background-position: 100% 50%;
  }
`;

export const PreviewColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};

  ${({ theme }) => (theme as StyledTheme).breakpoints.up('md')} {
    flex-direction: row;
    align-items: flex-start;
  }
`;

export const HelpButton = styled(IconButton)`
  grid-column: 3;
  justify-self: end;
  margin-bottom: 1rem;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
`;

export const StartMergeButton = styled(Button)`
  background-color: #0080ff;
  color: #ffffff;
  font-weight: 600;
  border-radius: 0.75rem;
  padding: 12px;
  box-shadow: none;

  &:hover {
    background-color: #0073e6;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &.Mui-disabled {
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.disabledBackground};
    color: ${({ theme }) => (theme as StyledTheme).palette.action.disabled};
  }
`;
