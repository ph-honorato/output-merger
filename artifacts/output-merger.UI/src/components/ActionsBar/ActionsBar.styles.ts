import styled from "styled-components";
import type { StyledTheme } from "@theme";

export const ActionsBarRoot = styled.div<{ $justifyContent?: string }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $justifyContent }) => $justifyContent ?? "flex-end"};
  width: 100%;
  min-height: 50px;
  box-sizing: border-box;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: ${({ theme }) => (theme as StyledTheme).borderRadius};
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);

  > button {
    height: 40px;
  }
`;
