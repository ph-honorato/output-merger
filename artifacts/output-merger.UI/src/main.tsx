import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import CssBaseline from '@mui/material/CssBaseline'
import { borderRadius } from './theme'
import { ThemeProvider, useThemeContext } from './context/ThemeContext'
import './index.css'
import App from './App.tsx'

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