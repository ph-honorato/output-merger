import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';
import { withAlpha } from '../../../../utils/color';

type StyledTheme = DefaultTheme & Theme;

interface SegmentChipProps {
  // Snippet color used for the chip tint and its hover deepening
  $color?: string;
  // Round 6: while true (edit mode ON) the chip is a plain span of
  // the editor — text cursor, text selection, no drag affordances.
  $editing?: boolean;
}

export const SegmentChip = styled.span<SegmentChipProps>`
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  white-space: pre-wrap;
  cursor: ${({ $editing }) => ($editing ? 'text' : 'grab')};
  user-select: ${({ $editing }) => ($editing ? 'text' : 'none')};
  -webkit-user-select: ${({ $editing }) => ($editing ? 'text' : 'none')};
  touch-action: ${({ $editing }) => ($editing ? 'auto' : 'none')};
  -webkit-touch-callout: ${({ $editing }) => ($editing ? 'default' : 'none')};
  background-color: ${({ $color }) =>
    $color ? withAlpha($color, 0.3) : 'transparent'};

  &:hover {
    background-color: ${({ $color, $editing }) =>
      $editing
        ? $color
          ? withAlpha($color, 0.3)
          : 'transparent'
        : $color
          ? withAlpha($color, 0.4)
          : 'transparent'};
  }

  &:focus-visible {
    outline: 2px solid
      ${({ theme }) => (theme as StyledTheme).palette.primary.main};
    outline-offset: 2px;
  }
`;
