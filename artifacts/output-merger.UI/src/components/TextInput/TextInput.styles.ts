import styled from 'styled-components';
import TextField from '@mui/material/TextField';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

export const TextInputRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  min-height: 400px;
  box-sizing: border-box;
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: 0.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
`;

export const Label = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
`;

export const StyledTextField = styled(TextField)<{ $accent?: string }>`
  flex: 1;
  min-height: 0;

  & .MuiInputBase-root {
    flex: 1;
    min-height: 0;
    align-items: stretch;
  }

  & .MuiInputBase-input {
    height: 100% !important;
    box-sizing: border-box;
    resize: none;
  }

  & .MuiOutlinedInput-root.Mui-focused {
    outline: 2px solid ${({ theme, $accent }) =>
      $accent ?? (theme as StyledTheme).palette.primary.main};
    outline-offset: 2px;
    transition: outline-color 200ms ease;
  }
`;

export const TextViewContainer = styled.div<{ $dragging?: boolean }>`
  position: relative;
  text-align: start;
  white-space: pre-wrap;
  word-break: break-word;
  touch-action: none;
  cursor: ${({ $dragging }) => ($dragging ? 'ew-resize' : 'default')};
  line-height: 1.8;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  -webkit-user-select: none;
  user-select: none;
`;

export const Highlight = styled.span`
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
`;

export const Needle = styled.span`
  position: absolute;
  width: 4px;
  height: 1.5em;
  border-radius: 2px;
  cursor: ew-resize;
  transition: background-color 200ms ease;

  &::before {
    content: '';
    position: absolute;
    top: -4px;
    bottom: -4px;
    left: -6px;
    right: -6px;
  }
`;

export const Counter = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
  align-self: flex-end;
`;

export const EmptyState = styled.p`
  margin: 0;
  font-size: 0.875rem;
  font-style: italic;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
`;
