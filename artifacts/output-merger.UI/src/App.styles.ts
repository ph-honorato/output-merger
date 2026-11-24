import styled from "styled-components";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";
import { MOBILE_MAX_WIDTH } from "@theme";

type StyledTheme = DefaultTheme & Theme;

export const MainContainer = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const PageContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(3)} 0;

  @media (max-width: ${MOBILE_MAX_WIDTH}px) {
    padding: ${({ theme }) => (theme as StyledTheme).spacing(2)} 0;
  }
`;
