import styled from 'styled-components';
import type { StyledTheme } from "@theme";

export const ToastMessage = styled.div`
  padding: ${({ theme }) => (theme as StyledTheme).spacing(1)}
    ${({ theme }) => (theme as StyledTheme).spacing(2)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border-radius: ${({ theme }) => (theme as StyledTheme).borderRadius};
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;
