import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

export const ActionsBarRoot = styled.div<{ $justifyContent?: string }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $justifyContent }) => $justifyContent ?? 'flex-end'};
  width: 100%;
  min-height: 74px;
  box-sizing: border-box;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;
