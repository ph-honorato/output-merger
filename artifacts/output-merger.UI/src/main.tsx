import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MuiThemeProvider theme={theme}>
      <StyledThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </StyledThemeProvider>
    </MuiThemeProvider>
  </StrictMode>,
)
