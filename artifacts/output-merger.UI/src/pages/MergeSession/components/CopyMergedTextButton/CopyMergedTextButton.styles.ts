import styled from 'styled-components';
import type { StyledTheme } from "@theme";

// Header height (64px) + spacing (8px) = 72px offset from viewport top
const TOAST_TOP_OFFSET = 72;

export const ToastMessage = styled.div`
  padding: ${({ theme }) => (theme as StyledTheme).spacing(1)}
    ${({ theme }) => (theme as StyledTheme).spacing(2)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border-radius: ${({ theme }) => (theme as StyledTheme).borderRadius};
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-top: ${TOAST_TOP_OFFSET}px;
`;
