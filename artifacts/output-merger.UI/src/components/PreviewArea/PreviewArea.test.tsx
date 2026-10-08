import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { theme } from '../../theme';
import PreviewArea from './PreviewArea';
import i18n from '../../i18n';
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

describe('PreviewArea Component', () => {
  it('should render the preview area root', () => {
    renderWithProviders(<PreviewArea />);
    expect(screen.getByTestId('preview-area')).toBeInTheDocument();
  });

  it('should render no visible content', () => {
    renderWithProviders(<PreviewArea />);
    expect(screen.getByTestId('preview-area')).toBeEmptyDOMElement();
  });

  it('should have aria-hidden true', () => {
    renderWithProviders(<PreviewArea />);
    expect(screen.getByTestId('preview-area')).toHaveAttribute('aria-hidden', 'true');
  });
});
