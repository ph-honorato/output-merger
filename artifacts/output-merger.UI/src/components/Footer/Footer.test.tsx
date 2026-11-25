import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { theme } from '@theme';
import { ThemeProvider } from '@context/ThemeContext';
import Footer from './Footer';
import { i18n } from '@translation';
import { I18nextProvider } from 'react-i18next';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            {component}
          </StyledThemeProvider>
        </MuiThemeProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
};

describe('Footer Component', () => {
  const setup = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('language', 'en-US');
    }
    i18n.changeLanguage('en');
    return renderWithProviders(<Footer />);
  };

  it('should render footer', () => {
    setup();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('should render github link with correct href', () => {
    setup();
    const link = screen.getByTestId('footer-github-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/ph-honorato');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});