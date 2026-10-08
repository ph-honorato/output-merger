import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

export const PreviewToolbarRoot = styled.div`
  position: absolute;
  right: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(0.5)};
  padding: ${({ theme }) => (theme as StyledTheme).spacing(0.5)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  z-index: 1;
`;
