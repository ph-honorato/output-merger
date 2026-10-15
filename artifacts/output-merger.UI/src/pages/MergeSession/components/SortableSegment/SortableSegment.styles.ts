import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';
import { withAlpha } from '../../../../utils/color';

type StyledTheme = DefaultTheme & Theme;

interface SegmentChipProps {
  // Snippet color used for the chip tint and its hover deepening
  $color?: string;
}

export const SegmentChip = styled.span<SegmentChipProps>`
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  white-space: pre-wrap;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  -webkit-touch-callout: none;
  background-color: ${({ $color }) =>
    $color ? withAlpha($color, 0.3) : 'transparent'};

  &:hover {
    background-color: ${({ $color }) =>
      $color ? withAlpha($color, 0.4) : 'transparent'};
  }

  &:focus-visible {
    outline: 2px solid
      ${({ theme }) => (theme as StyledTheme).palette.primary.main};
    outline-offset: 2px;
  }
`;
