import type { DefaultTheme } from 'styled-components';
import type { Theme } from '@mui/material/styles';

/**
 * Extended theme type that includes the borderRadius token
 * for use in styled-components
 */
export type StyledTheme = DefaultTheme & Theme & {
  borderRadius: string;
};

// Module augmentation to add borderRadius to MUI's Theme
declare module '@mui/material/styles' {
  interface Theme {
    borderRadius: string;
  }
  interface ThemeOptions {
    borderRadius?: string;
  }
}