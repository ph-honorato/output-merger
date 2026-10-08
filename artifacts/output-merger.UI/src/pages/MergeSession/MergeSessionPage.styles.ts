import styled from 'styled-components';
import Button from '@mui/material/Button';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(3)};
  width: 100%;
  text-align: center;
`;

export const Title = styled.h1`
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  background: linear-gradient(135deg, #0080ff, #ff1493, #00ffff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
`;

export const Subtitle = styled.p`
  font-size: 1.25rem;
  color: var(--mui-palette-text-secondary);
  max-width: 600px;
  margin: 0 auto 1rem;
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
    color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.disabled};
  }
`;
