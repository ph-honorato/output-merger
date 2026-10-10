import styled from "styled-components";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";

type StyledTheme = DefaultTheme & Theme;

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
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
`;

export const PreviewColumn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
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
