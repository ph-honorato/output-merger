import styled from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

type StyledTheme = DefaultTheme & Theme;

/**
 * The preview document's character counter: the current count only
 * (no limit suffix), in the text inputs' counter font size. Below
 * the limit it uses the secondary text tone; AT or OVER the limit
 * it turns the theme's error red. `align-self: stretch` +
 * `text-align: center` (instead of a right-edge `flex-end`, which
 * widens a vertical rail like the modal's tools rack): inside the
 * preview card the absolute pin anchors the alignment, and in the
 * rail the number centers on the rail's width — a number of at
 * most five digits is never wider than the rail's icon buttons.
 */
export const PreviewCharCount = styled.span<{ $atLimit?: boolean }>`
  font-size: 0.875rem;
  color: ${({ theme, $atLimit }) =>
    $atLimit
      ? (theme as StyledTheme).palette.error.main
      : (theme as StyledTheme).palette.text.secondary};
  align-self: stretch;
  text-align: center;
`;
