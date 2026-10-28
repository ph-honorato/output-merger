/// <reference types="vite/client" />
/// <reference types="styled-components" />

import { Theme as MuiTheme } from '@mui/material/styles';

interface ImportMetaEnv {
  /** The preview document's maximum length (fallback 2000). */
  readonly VITE_PREVIEW_MAX_LENGTH?: string;
  /** Each text input's maximum length (fallback 500). */
  readonly VITE_TEXT_INPUT_MAX_LENGTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@mui/material/styles' {
  interface Theme {
    borderRadius: string;
  }
  interface ThemeOptions {
    borderRadius?: string;
  }
}

declare module 'styled-components' {
  export interface DefaultTheme extends MuiTheme {
    borderRadius: string;
  }
}
