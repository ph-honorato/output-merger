import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { theme } from '@theme';
import { ThemeProvider } from '@context/ThemeContext';
import Header from './Header';
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

describe('Header Component', () => {
  const setup = (language: 'en-US' | 'pt-BR' = 'en-US') => {
    // Set language in localStorage before rendering
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('language', language);
    }
    i18n.changeLanguage(language === 'en-US' ? 'en' : 'pt');
    
    return renderWithProviders(<Header />);
  };

  it('should render config selector button', () => {
    setup();
    const button = screen.getByTestId('config-selector-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Settings');
  });

  it('should open config menu on button click', async () => {
    setup();
    const user = userEvent.setup();
    const button = screen.getByTestId('config-selector-button');
    
    await user.click(button);
    
    const menu = screen.getByTestId('config-menu');
    expect(menu).toBeInTheDocument();
  });

  it('should display both language options in menu', async () => {
    setup();
    const user = userEvent.setup();
    const button = screen.getByTestId('config-selector-button');
    
    await user.click(button);
    
    const enOption = screen.getByTestId('config-language-option-en-US');
    const ptOption = screen.getByTestId('config-language-option-pt-BR');
    
    expect(enOption).toBeInTheDocument();
      expect(enOption).toHaveTextContent('English (US)');
    expect(ptOption).toBeInTheDocument();
    expect(ptOption).toHaveTextContent('Português (BR)');
  });

  it('should change language when option is clicked', async () => {
    setup('en-US');
    const user = userEvent.setup();
    const button = screen.getByTestId('config-selector-button');
    
    await user.click(button);
    
    const ptOption = screen.getByTestId('config-language-option-pt-BR');
    await user.click(ptOption);
  });

  it('should render mobile menu button on small screens', () => {
    setup();
    const mobileButton = screen.getByTestId('mobile-menu-button');
    expect(mobileButton).toBeInTheDocument();
  });

  it('should display language flags in menu options', async () => {
    setup();
    const user = userEvent.setup();
    const button = screen.getByTestId('config-selector-button');
    
    await user.click(button);
    
    const enOption = screen.getByTestId('config-language-option-en-US');
    const ptOption = screen.getByTestId('config-language-option-pt-BR');
    
    expect(enOption).toHaveTextContent('🇺🇸');
    expect(ptOption).toHaveTextContent('🇧🇷');
  });

  it('should mark current language as selected', async () => {
    setup('pt-BR');
    const user = userEvent.setup();
    const button = screen.getByTestId('config-selector-button');
    
    await user.click(button);
    
    const ptOption = screen.getByTestId('config-language-option-pt-BR');
    expect(ptOption).toHaveClass('selected');
  });

  it('should display dark mode toggle in config menu', async () => {
    setup();
    const user = userEvent.setup();
    const button = screen.getByTestId('config-selector-button');
    
    await user.click(button);
    
    const darkModeToggle = screen.getByTestId('config-darkmode-toggle');
    expect(darkModeToggle).toBeInTheDocument();
    expect(darkModeToggle).toHaveTextContent('Dark mode');
  });
});