import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

export const PreviewAreaRoot = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  min-height: 400px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
`;

export const SegmentFlow = styled.div`
  display: block;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  text-align: left;
`;

export const Segment = styled.span`
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  white-space: pre-wrap;
`;
