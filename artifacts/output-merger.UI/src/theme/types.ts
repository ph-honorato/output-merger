import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

/**
 * Extended theme type that includes the borderRadius token
 * for use in styled-components
 */
export type StyledTheme = DefaultTheme & Theme & {
  borderRadius: string;
};