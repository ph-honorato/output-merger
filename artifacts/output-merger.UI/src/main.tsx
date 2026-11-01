import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import CssBaseline from '@mui/material/CssBaseline'
import { borderRadius } from './theme'
import { ThemeProvider, useThemeContext } from './context/ThemeContext'
import './index.css'
import App from './App.tsx'
import DOMPurify from 'dompurify'

/**
 * Initialize Trusted Types policy for DOM XSS protection.
 * This policy delegates to DOMPurify for sanitizing HTML.
 * Only runs in Chromium-based browsers that support Trusted Types.
 */
interface TrustedTypes {
  createPolicy(
    policyName: string,
    policyOptions: {
      createHTML?: (input: string) => string;
      createScriptURL?: (input: string) => string;
      createScript?: (input: string) => string;
    }
  ): TrustedTypePolicy;
}

interface TrustedTypePolicy {
  createHTML: (input: string) => string;
  createScriptURL: (input: string) => string;
  createScript: (input: string) => string;
}

declare global {
  interface Window {
    trustedTypes?: TrustedTypes;
  }
}

if (typeof window !== 'undefined' && window.trustedTypes) {
  try {
    window.trustedTypes.createPolicy('output-merger-sanitizer', {
      createHTML: (input: string) => DOMPurify.sanitize(input),
      createScriptURL: (input: string) => input,
    });
  } catch (error) {
    // Policy might already exist, or Trusted Types not fully supported
    console.debug('Trusted Types policy initialization:', error);
  }
}

// Wrapper component that consumes the theme context and provides it to MUI and styled-components
const ThemedApp = () => {
  const { theme } = useThemeContext();
  
  // Create a theme for styled-components that includes borderRadius
  const styledTheme = {
    ...theme,
    borderRadius,
  }

  return (
    <MuiThemeProvider theme={theme}>
      <StyledThemeProvider theme={styledTheme}>
        <CssBaseline />
        <App />
      </StyledThemeProvider>
    </MuiThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </StrictMode>,
)