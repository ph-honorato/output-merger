import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { theme } from '../../theme';
import MergeSessionPage from './MergeSessionPage';

const renderPage = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <MergeSessionPage />
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
  );

describe('MergeSessionPage', () => {
  it('renders both sources in input mode with a disabled start button', () => {
    renderPage();

    expect(screen.getAllByTestId('text-input-textarea')).toHaveLength(2);
    expect(screen.getByTestId('merge-session-start-button')).toBeDisabled();
  });

  it('enables the start button once a source has text', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');

    expect(screen.getByTestId('merge-session-start-button')).toBeEnabled();
  });

  it('does not enable the start button for whitespace-only text', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], '   ');

    expect(screen.getByTestId('merge-session-start-button')).toBeDisabled();
  });

  it('enters merge mode on click: button hidden, sources in view mode, text preserved', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getAllByTestId('text-input-textarea')[0], 'Hello world');
    await user.click(screen.getByTestId('merge-session-start-button'));

    expect(screen.queryByTestId('merge-session-start-button')).toBeNull();
    expect(screen.queryByTestId('text-input-textarea')).toBeNull();
    expect(screen.getByTestId('text-input-view')).toHaveTextContent('Hello world');
    expect(screen.getByTestId('text-input-empty')).toBeInTheDocument();
    expect(screen.getByTestId('actions-bar-root')).toBeInTheDocument();
    expect(screen.getByTestId('preview-area')).toBeInTheDocument();
  });
});
