import styled from 'styled-components';
import IconButton from '@mui/material/IconButton';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

/**
 * The toggle's IconButton with a visible ON state: an icon-only
 * button shows no text, so the pressed state is carried by the
 * theme's primary color and selected background while
 * `aria-pressed` carries it for assistive tech.
 */
export const ToggleIconButton = styled(IconButton)`
  &[aria-pressed='true'] {
    color: ${({ theme }) => (theme as StyledTheme).palette.primary.main};
    background-color: ${({ theme }) =>
      (theme as StyledTheme).palette.action.selected};
  }
`;
