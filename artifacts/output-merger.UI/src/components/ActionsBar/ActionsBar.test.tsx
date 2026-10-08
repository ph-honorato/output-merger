import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { theme } from '../../theme';
import ActionsBar from './ActionsBar';
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

describe('ActionsBar Component', () => {
  it('should render the bar root', () => {
    renderWithProviders(<ActionsBar />);
    const root = screen.getByTestId('actions-bar-root');
    expect(root).toBeInTheDocument();
  });

  it('should render given children', () => {
    renderWithProviders(
      <ActionsBar>
        <button>Confirm</button>
      </ActionsBar>
    );
    const button = screen.getByRole('button', { name: 'Confirm' });
    expect(button).toBeInTheDocument();
    expect(button).toBeVisible();
  });

  it('should align children to the right by default', () => {
    renderWithProviders(<ActionsBar />);
    const root = screen.getByTestId('actions-bar-root');
    expect(root).toHaveStyle({ justifyContent: 'flex-end' });
  });

  it('should align children to the left when align is left', () => {
    renderWithProviders(<ActionsBar align="left" />);
    const root = screen.getByTestId('actions-bar-root');
    expect(root).toHaveStyle({ justifyContent: 'flex-start' });
  });

  it('should render without children without crashing', () => {
    renderWithProviders(<ActionsBar />);
    const root = screen.getByTestId('actions-bar-root');
    expect(root).toBeInTheDocument();
    expect(root.childElementCount).toBe(0);
  });
});
