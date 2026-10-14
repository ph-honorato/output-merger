import styled from 'styled-components';
import IconButton from '@mui/material/IconButton';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

export const TutorialBannerRoot = styled.div`
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  text-align: left;
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

export const TutorialHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
`;

export const TutorialTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
`;

export const TutorialSteps = styled.ol`
  margin: ${({ theme }) => (theme as StyledTheme).spacing(1)} 0 0;
  padding-left: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  line-height: 1.8;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
`;

export const DismissButton = styled(IconButton)`
  margin: ${({ theme }) => (theme as StyledTheme).spacing(-0.5)};
`;
