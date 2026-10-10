import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { theme } from '../../../../theme';
import PreviewToolbar from './PreviewToolbar';
import i18n from '../../../../i18n';
import { I18nextProvider } from 'react-i18next';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          {component}
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
  );
};

describe('PreviewToolbar Component', () => {
  it('should render the toolbar root', () => {
    renderWithProviders(<PreviewToolbar />);
    const root = screen.getByTestId('preview-toolbar');
    expect(root).toBeInTheDocument();
  });

  it('should render given children', () => {
    renderWithProviders(
      <PreviewToolbar>
        <button>tool-x</button>
      </PreviewToolbar>
    );
    const button = screen.getByRole('button', { name: 'tool-x' });
    expect(button).toBeInTheDocument();
    expect(button).toBeVisible();
  });

  it('should be statically positioned as a sibling beside the preview card', () => {
    renderWithProviders(<PreviewToolbar />);
    const root = screen.getByTestId('preview-toolbar');
    expect(root).toHaveStyle({ position: 'static' });
  });

  it('should be column-oriented', () => {
    renderWithProviders(<PreviewToolbar />);
    const root = screen.getByTestId('preview-toolbar');
    expect(root).toHaveStyle({ flexDirection: 'column' });
  });
});
